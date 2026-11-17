import { Inject, Injectable } from '@nestjs/common';

import {
  canEditBusiness,
  ADDRESS_LINE_MAX,
  BUSINESS_NAME_MAX,
  BUSINESS_NAME_MIN,
} from '../domain/business.js';
import { BusinessError } from '../domain/business-error.js';
import { normalizeWhatsapp } from '../domain/business.js';
import type { BusinessContext, BusinessRepository, UpdateBusinessInput } from './ports.js';
import { BUSINESS_REPOSITORY } from './tokens.js';

/**
 * Lectura del negocio del actor (E2-H3).
 *
 * El tenant se resuelve por `user_id` de la sesión: no hay ningún parámetro
 * `businessId` en la entrada, así que un cliente no puede pedir otro negocio.
 */
@Injectable()
export class GetMyBusinessUseCase {
  constructor(@Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository) {}

  async execute(userId: string): Promise<BusinessContext> {
    const context = await this.businesses.findByUserId(userId);
    if (!context) {
      throw new BusinessError('BUSINESS_NOT_FOUND', 'Todavía no tienes un negocio registrado');
    }
    return context;
  }
}

/** Edición del perfil por parte de un miembro con permiso de escritura (E2-H4). */
@Injectable()
export class UpdateBusinessUseCase {
  constructor(@Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository) {}

  async execute(userId: string, changes: UpdateBusinessInput): Promise<BusinessContext> {
    const context = await this.businesses.findByUserId(userId);
    if (!context) {
      throw new BusinessError('BUSINESS_NOT_FOUND', 'Todavía no tienes un negocio registrado');
    }
    if (!canEditBusiness(context.membershipRole)) {
      throw new BusinessError('FORBIDDEN', 'Tu rol no permite editar el negocio');
    }

    const data: UpdateBusinessInput = {};

    if (changes.name !== undefined) {
      const name = changes.name.trim();
      if (name.length < BUSINESS_NAME_MIN || name.length > BUSINESS_NAME_MAX) {
        throw new BusinessError('INVALID_NAME', 'El nombre debe tener entre 2 y 80 caracteres');
      }
      data.name = name;
    }

    if (changes.city !== undefined) data.city = changes.city;

    if (changes.addressLine !== undefined) {
      const addressLine = changes.addressLine?.trim() || null;
      if (addressLine && addressLine.length > ADDRESS_LINE_MAX) {
        throw new BusinessError('INVALID_ADDRESS', 'La dirección no puede superar 160 caracteres');
      }
      data.addressLine = addressLine;
    }

    if (changes.whatsapp !== undefined) {
      const whatsapp = normalizeWhatsapp(changes.whatsapp);
      if (!whatsapp) {
        throw new BusinessError('INVALID_WHATSAPP', 'El WhatsApp debe ser un celular colombiano');
      }
      data.whatsapp = whatsapp;
    }

    if (Object.keys(data).length === 0) {
      throw new BusinessError('INVALID_INPUT', 'No hay campos para actualizar');
    }

    const business = await this.businesses.updateProfile(context.business.id, data);
    return { ...context, business };
  }
}
