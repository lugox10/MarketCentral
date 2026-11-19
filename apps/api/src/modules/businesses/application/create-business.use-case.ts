import { Inject, Injectable } from '@nestjs/common';

import { addCalendarMonths, addUtcDays } from '../../../common/utils/dates.js';
import {
  ADDRESS_LINE_MAX,
  BUSINESS_NAME_MAX,
  BUSINESS_NAME_MIN,
  FREE_PLAN_CODE,
  MAX_BUSINESSES_PER_OWNER,
  MIN_HOURS_BETWEEN_BUSINESSES,
  areFingerprintsSimilar,
  normalizeFingerprint,
  normalizeWhatsapp,
  slugify,
} from '../domain/business.js';
import { BusinessError } from '../domain/business-error.js';
import type { AmvaCity } from '../domain/business.js';
import type { BusinessContext, BusinessRepository, PlanRepository } from './ports.js';
import { BUSINESS_REPOSITORY, PLAN_REPOSITORY } from './tokens.js';

export interface CreateBusinessCommand {
  userId: string;
  verticalId: string;
  name: string;
  city: AmvaCity;
  addressLine: string;
  whatsapp: string;
}

/** Colisión del índice único (Prisma P2002), sin acoplar la aplicación a Prisma. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
  );
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Alta de negocio (E2-H2 + E5 fase 1).
 *
 * Una sola transacción crea `business` + `business_membership(OWNER)` +
 * `subscription(TRIALING)` con el plan Free. El `userId` y la vertical se
 * validan antes de escribir: el dueño sale del `ActorContext` (sesión).
 */
@Injectable()
export class CreateBusinessUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
  ) {}

  async execute(command: CreateBusinessCommand): Promise<BusinessContext> {
    const name = command.name.trim();
    if (name.length < BUSINESS_NAME_MIN || name.length > BUSINESS_NAME_MAX) {
      throw new BusinessError('INVALID_NAME', 'El nombre debe tener entre 2 y 80 caracteres');
    }

    const addressLine = command.addressLine?.trim() ?? '';
    if (addressLine.length < 5 || addressLine.length > ADDRESS_LINE_MAX) {
      throw new BusinessError(
        'INVALID_ADDRESS',
        'La dirección es obligatoria y no puede superar 160 caracteres',
      );
    }

    const whatsapp = normalizeWhatsapp(command.whatsapp);
    if (!whatsapp) {
      throw new BusinessError('INVALID_WHATSAPP', 'El WhatsApp debe ser un celular colombiano');
    }

    const vertical = await this.businesses.findVertical(command.verticalId);
    if (!vertical) {
      throw new BusinessError('VERTICAL_NOT_FOUND', 'La vertical no existe');
    }
    if (!vertical.isActive) {
      throw new BusinessError('VERTICAL_INACTIVE', 'La vertical no está disponible');
    }

    const existing = await this.businesses.findByUserId(command.userId);
    if (existing) {
      throw new BusinessError(
        'ALREADY_HAS_BUSINESS',
        'Ya tienes un negocio registrado en esta vertical',
      );
    }

    const owned = await this.businesses.countByOwner(command.userId);
    if (owned >= MAX_BUSINESSES_PER_OWNER) {
      throw new BusinessError(
        'OWNER_LIMIT_REACHED',
        `Cada persona puede tener como máximo ${MAX_BUSINESSES_PER_OWNER} negocios`,
      );
    }

    const lastCreatedAt = await this.businesses.lastCreatedAtByOwner(command.userId);
    if (lastCreatedAt) {
      const elapsed = Date.now() - lastCreatedAt.getTime();
      if (elapsed < MIN_HOURS_BETWEEN_BUSINESSES * HOUR_MS) {
        throw new BusinessError(
          'NEW_BUSINESS_TOO_SOON',
          `Debes esperar ${MIN_HOURS_BETWEEN_BUSINESSES} horas para registrar otro negocio`,
        );
      }
    }

    if (await this.businesses.findWhatsappInVertical(vertical.id, whatsapp)) {
      throw new BusinessError('WHATSAPP_TAKEN', 'Ese WhatsApp ya está registrado en esta vertical');
    }

    const fingerprint = normalizeFingerprint(name, addressLine);
    const fingerprints = await this.businesses.listFingerprints(vertical.id);
    if (fingerprints.includes(fingerprint)) {
      throw new BusinessError(
        'DUPLICATE_BUSINESS',
        'Ya existe un negocio con ese nombre y dirección en esta vertical',
      );
    }
    const flaggedForReview = fingerprints.some((other) =>
      areFingerprintsSimilar(fingerprint, other),
    );

    const plan = await this.plans.findByCode(FREE_PLAN_CODE);
    if (!plan) {
      throw new BusinessError('PLAN_NOT_FOUND', 'El plan Free no está configurado');
    }
    // Cerrar las altas es una palanca del SUPER_ADMIN: se desactiva el plan Free.
    if (!plan.isActive) {
      throw new BusinessError(
        'SIGNUPS_CLOSED',
        'Las altas de negocios están cerradas temporalmente',
      );
    }

    const now = new Date();
    // La prueba puede venir en meses calendario o, si el admin la ajusta, en días.
    const periodEnd =
      plan.trialDays !== null && plan.trialDays > 0
        ? addUtcDays(now, plan.trialDays)
        : addCalendarMonths(now, plan.trialMonths);
    const hasTrial = plan.trialDays !== null ? plan.trialDays > 0 : plan.trialMonths > 0;
    const baseSlug = slugify(name);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const slug =
        attempt === 0
          ? baseSlug
          : attempt < 5
            ? `${baseSlug}-${attempt + 1}`.slice(0, 60)
            : `${baseSlug.slice(0, 53)}-${Math.random().toString(36).slice(2, 8)}`;

      try {
        return await this.businesses.createWithOwner({
          ownerUserId: command.userId,
          verticalId: vertical.id,
          name,
          city: command.city,
          addressLine,
          whatsapp,
          fingerprint,
          slug,
          flaggedForReview,
          now,
          periodEnd,
          planId: plan.id,
          subscriptionStatus: hasTrial ? 'TRIALING' : 'ACTIVE',
        });
      } catch (error: unknown) {
        if (isUniqueViolation(error) && attempt < 5) continue;
        if (isUniqueViolation(error)) {
          throw new BusinessError(
            'SLUG_EXHAUSTED',
            'No fue posible generar un identificador único',
          );
        }
        throw error;
      }
    }

    throw new BusinessError('SLUG_EXHAUSTED', 'No fue posible generar un identificador único');
  }
}
