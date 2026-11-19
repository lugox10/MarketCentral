import { Inject, Injectable } from '@nestjs/common';

import { extensionFor, inspectImage } from '../../../common/media/image-inspector.js';
import type { MediaStorage } from '../../../common/media/media-storage.js';
import { MEDIA_STORAGE } from '../../../common/media/media.tokens.js';
import { canEditBusiness } from '../domain/business.js';
import { BusinessError } from '../domain/business-error.js';
import type { BusinessContext, BusinessImageKind, BusinessRepository } from './ports.js';
import { BUSINESS_REPOSITORY } from './tokens.js';

/** Archivo que llega desde `FileInterceptor` (en memoria, ya limitado por multer). */
export interface BusinessImageUpload {
  buffer: Buffer;
  size: number;
}

interface ImageRule {
  maxBytes: number;
  minWidth: number;
  minHeight: number;
  label: string;
}

/**
 * Reglas de las imágenes de identidad. El logo se ve a 56–96 px, así que 200×200
 * es el mínimo razonable; la portada se recorta a 3:1 en escritorio, así que
 * 1200×600 evita que se vea borrosa.
 */
const RULES: Record<BusinessImageKind, ImageRule> = {
  logo: { maxBytes: 2 * 1024 * 1024, minWidth: 200, minHeight: 200, label: 'El logo' },
  cover: { maxBytes: 5 * 1024 * 1024, minWidth: 1200, minHeight: 600, label: 'La portada' },
};

async function requireEditableContext(
  businesses: BusinessRepository,
  userId: string,
): Promise<BusinessContext> {
  const context = await businesses.findByUserId(userId);
  if (!context) {
    throw new BusinessError('BUSINESS_NOT_FOUND', 'Todavía no tienes un negocio registrado');
  }
  if (!canEditBusiness(context.membershipRole)) {
    throw new BusinessError('FORBIDDEN', 'Tu rol no permite editar la tienda');
  }
  return context;
}

/** Sube (o reemplaza) el logo o la portada del negocio del actor. */
@Injectable()
export class SetBusinessImageUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  async execute(
    userId: string,
    kind: BusinessImageKind,
    file: BusinessImageUpload,
  ): Promise<BusinessContext> {
    const context = await requireEditableContext(this.businesses, userId);
    const rule = RULES[kind];

    if (file.size > rule.maxBytes) {
      throw new BusinessError(
        'IMAGE_TOO_LARGE',
        `${rule.label} no puede superar ${Math.round(rule.maxBytes / (1024 * 1024))} MB`,
      );
    }

    // El tipo se decide por los bytes, nunca por el Content-Type del cliente.
    const info = inspectImage(file.buffer);
    if (!info) {
      throw new BusinessError('INVALID_IMAGE_TYPE', 'El archivo debe ser JPEG, PNG o WebP');
    }

    if (
      info.width !== null &&
      info.height !== null &&
      (info.width < rule.minWidth || info.height < rule.minHeight)
    ) {
      throw new BusinessError(
        'INVALID_IMAGE_DIMENSIONS',
        `${rule.label} debe medir al menos ${rule.minWidth}×${rule.minHeight} px`,
      );
    }

    const key = `businesses/${context.business.id}/${kind}-${Date.now()}.${extensionFor(info.mimeType)}`;
    const previousKey = await this.businesses.findImageKey(context.business.id, kind);

    await this.storage.put(key, file.buffer, info.mimeType);

    const business = await this.businesses.setImageKey(context.business.id, kind, key);

    // Reemplazo: se borra el objeto anterior, sin romper la operación si falla.
    if (previousKey && previousKey !== key) {
      await this.storage.delete(previousKey).catch(() => undefined);
    }

    return { ...context, business };
  }
}

/** Quita el logo o la portada del negocio del actor. */
@Injectable()
export class ClearBusinessImageUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  async execute(userId: string, kind: BusinessImageKind): Promise<BusinessContext> {
    const context = await requireEditableContext(this.businesses, userId);
    const previousKey = await this.businesses.findImageKey(context.business.id, kind);

    const business = await this.businesses.setImageKey(context.business.id, kind, null);

    if (previousKey) {
      await this.storage.delete(previousKey).catch(() => undefined);
    }

    return { ...context, business };
  }
}
