import { Inject, Injectable } from '@nestjs/common';

import { addCalendarMonths } from '../../../common/utils/dates.js';
import { BUSINESS_NAME_MAX, BUSINESS_NAME_MIN, FREE_PLAN_CODE } from '../domain/business.js';
import { BusinessError } from '../domain/business-error.js';
import type { AmvaCity } from '../domain/business.js';
import { normalizeWhatsapp, slugify, ADDRESS_LINE_MAX } from '../domain/business.js';
import type { BusinessContext, BusinessRepository, PlanRepository } from './ports.js';
import { BUSINESS_REPOSITORY, PLAN_REPOSITORY } from './tokens.js';

export interface CreateBusinessCommand {
  userId: string;
  name: string;
  city: AmvaCity;
  addressLine?: string | null;
  whatsapp: string;
}

/** Colisión del índice único (Prisma P2002), sin acoplar la aplicación a Prisma. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
  );
}

/**
 * Alta de negocio (E2-H2).
 *
 * Una sola transacción crea `business` + `business_membership(OWNER)` +
 * `subscription(TRIALING)` con el plan Free. El `userId` viene del
 * `ActorContext` (sesión), nunca del cuerpo de la petición.
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

    const addressLine = command.addressLine?.trim() || null;
    if (addressLine && addressLine.length > ADDRESS_LINE_MAX) {
      throw new BusinessError('INVALID_ADDRESS', 'La dirección no puede superar 160 caracteres');
    }

    const whatsapp = normalizeWhatsapp(command.whatsapp);
    if (!whatsapp) {
      throw new BusinessError('INVALID_WHATSAPP', 'El WhatsApp debe ser un celular colombiano');
    }

    const existing = await this.businesses.findByUserId(command.userId);
    if (existing) {
      throw new BusinessError('ALREADY_HAS_BUSINESS', 'Ya tienes un negocio registrado');
    }

    const plan = await this.plans.findByCode(FREE_PLAN_CODE);
    if (!plan) {
      throw new BusinessError('PLAN_NOT_FOUND', 'El plan Free no está configurado');
    }

    const now = new Date();
    // Prueba en meses calendario (E4): 2 meses desde el alta, no 60 días fijos.
    const periodEnd = addCalendarMonths(now, plan.trialMonths);
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
          userId: command.userId,
          name,
          city: command.city,
          addressLine,
          whatsapp,
          slug,
          now,
          periodEnd,
          planId: plan.id,
          subscriptionStatus: plan.trialMonths > 0 ? 'TRIALING' : 'ACTIVE',
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
