import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { addCalendarMonths, addUtcDays, DAY_MS } from '../../../common/utils/dates.js';
import type { BusinessRepository } from '../../businesses/application/ports.js';
import { BUSINESS_REPOSITORY } from '../../businesses/application/tokens.js';
import type { MailSender } from '../../auth/application/ports.js';
import { MAIL_SENDER } from '../../auth/application/tokens.js';
import {
  assertPayablePlan,
  computeActivationSchedule,
  normalizeActivationNote,
  normalizeIdempotencyKey,
} from '../domain/subscription.js';
import { SubscriptionError } from '../domain/subscription-error.js';
import type {
  ActivationResult,
  AdminSubscriptionPage,
  AdminSubscriptionQuery,
  PlanRecord,
  SubscriptionRecord,
  UpdatePlanInput,
} from './ports.js';
import { SUBSCRIPTION_REPOSITORY } from './tokens.js';
import type { SubscriptionRepository } from './ports.js';

/** Catálogo público de planes activos (E4-H1). */
@Injectable()
export class ListPlansUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
  ) {}

  async execute(): Promise<PlanRecord[]> {
    return this.subscriptions.findPlans();
  }
}

/**
 * Suscripción del negocio del actor.
 *
 * El negocio se resuelve desde su membresía (E2), nunca desde el cliente: no
 * existe un `businessId` de entrada. Antes de leer se reconcilian los periodos
 * vencidos, para que el estado persistido no se quede atrás.
 */
@Injectable()
export class GetMySubscriptionUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
  ) {}

  async execute(userId: string): Promise<SubscriptionRecord> {
    const context = await this.businesses.findByUserId(userId);
    if (!context) {
      throw new SubscriptionError('BUSINESS_NOT_FOUND', 'No tienes un negocio registrado');
    }

    const now = new Date();
    await this.subscriptions.expireOverdue(now);

    const subscription = await this.subscriptions.findByBusinessId(context.business.id);
    if (!subscription) {
      throw new SubscriptionError(
        'SUBSCRIPTION_NOT_FOUND',
        'El negocio todavía no tiene una suscripción; contacta a administración',
      );
    }
    return subscription;
  }
}

/** Listado administrativo con filtros y paginación (E4-H4). */
@Injectable()
export class ListAdminSubscriptionsUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
  ) {}

  async execute(query: AdminSubscriptionQuery): Promise<AdminSubscriptionPage> {
    await this.subscriptions.expireOverdue(new Date());
    return this.subscriptions.listAdmin(query);
  }
}

/** Historial inmutable de activaciones de un negocio (solo lectura). */
@Injectable()
export class GetSubscriptionHistoryUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
  ) {}

  async execute(businessId: string) {
    const business = await this.businesses.findById(businessId);
    if (!business) {
      throw new SubscriptionError('BUSINESS_NOT_FOUND', 'El negocio no existe');
    }
    return this.subscriptions.history(business.id);
  }
}

export interface ActivateSubscriptionCommand {
  businessId: string;
  adminId: string;
  planId: string;
  note: string;
  idempotencyKey: string | null;
}

/**
 * Activación manual de un plan pagado (E4-H3).
 *
 * El administrador sale del `ActorContext`; solo la nota y el plan vienen del
 * cuerpo. La actualización de la suscripción y el registro del historial son
 * una única transacción en el adaptador Prisma.
 */
@Injectable()
export class ActivateSubscriptionUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
  ) {}

  async execute(command: ActivateSubscriptionCommand): Promise<ActivationResult> {
    const now = new Date();

    const business = await this.businesses.findById(command.businessId);
    if (!business) {
      throw new SubscriptionError('BUSINESS_NOT_FOUND', 'El negocio no existe');
    }

    const plan = await this.subscriptions.findPlanById(command.planId);
    if (!plan) {
      throw new SubscriptionError('PLAN_NOT_FOUND', 'El plan no existe');
    }
    assertPayablePlan(plan);

    const note = normalizeActivationNote(command.note);
    const idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey);

    await this.subscriptions.expireOverdue(now);
    let current = await this.subscriptions.findByBusinessId(business.id);

    if (!current) {
      // Regularización de un negocio preexistente sin suscripción: se crea la
      // prueba Free en la misma operación administrativa y se activa el plan.
      const freePlan = await this.subscriptions.findPlanByCode('FREE');
      if (!freePlan) {
        throw new SubscriptionError('PLAN_NOT_FOUND', 'El plan Free no está configurado');
      }
      if (freePlan.trialMonths < 1) {
        throw new SubscriptionError(
          'INVALID_INPUT',
          'El plan Free debe definir al menos un mes de prueba',
        );
      }
      current = await this.subscriptions.ensureFreeSubscription({
        businessId: business.id,
        planId: freePlan.id,
        periodStart: now,
        periodEnd: addCalendarMonths(now, freePlan.trialMonths),
      });
    }

    const schedule = computeActivationSchedule(
      {
        status: current.status,
        currentPeriodStart: current.currentPeriodStart,
        currentPeriodEnd: current.currentPeriodEnd,
        planId: current.plan.id,
      },
      plan,
      now,
    );

    const requestHash = createHash('sha256')
      .update(`${business.id}:${plan.id}:${note}`)
      .digest('hex');

    return this.subscriptions.activate({
      subscriptionId: current.id,
      adminId: command.adminId,
      plan,
      note,
      kind: schedule.kind,
      periodStart: schedule.periodStart,
      previousPeriodEnd: schedule.previousPeriodEnd,
      newPeriodEnd: schedule.newPeriodEnd,
      idempotencyKey,
      requestHash,
      activatedAt: now,
    });
  }
}

const PLAN_LIMIT_MAX = 1000;

/** Edición de un plan desde el panel (precio, cupos, prueba y disponibilidad). */
@Injectable()
export class UpdatePlanUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
  ) {}

  async execute(planId: string, changes: UpdatePlanInput): Promise<PlanRecord> {
    const current = await this.subscriptions.findPlanById(planId);
    if (!current) {
      throw new SubscriptionError('PLAN_NOT_FOUND', 'El plan no existe');
    }

    const data: UpdatePlanInput = {};

    if (changes.priceCop !== undefined) {
      if (!Number.isInteger(changes.priceCop) || changes.priceCop < 0) {
        throw new SubscriptionError('INVALID_INPUT', 'El precio debe ser un entero positivo');
      }
      data.priceCop = changes.priceCop;
    }

    for (const key of ['maxListings', 'maxCategories', 'featuredSlots'] as const) {
      const value = changes[key];
      if (value === undefined) continue;
      if (!Number.isInteger(value) || value < 0 || value > PLAN_LIMIT_MAX) {
        throw new SubscriptionError(
          'INVALID_INPUT',
          'Los cupos deben ser enteros entre 0 y 1000',
        );
      }
      data[key] = value;
    }

    if (changes.trialMonths !== undefined) {
      if (!Number.isInteger(changes.trialMonths) || changes.trialMonths < 0 || changes.trialMonths > 12) {
        throw new SubscriptionError('INVALID_INPUT', 'La prueba en meses debe estar entre 0 y 12');
      }
      data.trialMonths = changes.trialMonths;
    }

    if (changes.trialDays !== undefined) {
      if (
        changes.trialDays !== null &&
        (!Number.isInteger(changes.trialDays) || changes.trialDays < 0 || changes.trialDays > 90)
      ) {
        throw new SubscriptionError('INVALID_INPUT', 'La prueba en días debe estar entre 0 y 90');
      }
      data.trialDays = changes.trialDays;
    }

    if (changes.billingPeriodDays !== undefined) {
      if (
        changes.billingPeriodDays !== null &&
        (!Number.isInteger(changes.billingPeriodDays) ||
          changes.billingPeriodDays < 1 ||
          changes.billingPeriodDays > 366)
      ) {
        throw new SubscriptionError('INVALID_INPUT', 'El periodo debe estar entre 1 y 366 días');
      }
      data.billingPeriodDays = changes.billingPeriodDays;
    }

    if (changes.isActive !== undefined) data.isActive = changes.isActive;

    if (Object.keys(data).length === 0) {
      throw new SubscriptionError('INVALID_INPUT', 'No hay campos para actualizar');
    }

    return this.subscriptions.updatePlan(planId, data);
  }
}

export interface AdjustTrialCommand {
  businessId: string;
  adminId: string;
  days: number;
  note: string;
}

const ALLOWED_TRIAL_DAYS = [0, 5, 15, 20] as const;

/**
 * Ajuste manual de la prueba (palanca del SUPER_ADMIN): 5, 15, 20 días o 0 para
 * revocarla. Solo aplica a `TRIALING` y deja rastro en el historial.
 */
@Injectable()
export class AdjustTrialUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
  ) {}

  async execute(command: AdjustTrialCommand): Promise<ActivationResult> {
    if (!(ALLOWED_TRIAL_DAYS as readonly number[]).includes(command.days)) {
      throw new SubscriptionError(
        'INVALID_INPUT',
        'Los días de prueba permitidos son 0, 5, 15 o 20',
      );
    }

    const note = normalizeActivationNote(command.note);
    const business = await this.businesses.findById(command.businessId);
    if (!business) {
      throw new SubscriptionError('BUSINESS_NOT_FOUND', 'El negocio no existe');
    }

    const current = await this.subscriptions.findByBusinessId(business.id);
    if (!current) {
      throw new SubscriptionError('SUBSCRIPTION_NOT_FOUND', 'El negocio no tiene suscripción');
    }
    if (current.status !== 'TRIALING') {
      throw new SubscriptionError(
        'INVALID_INPUT',
        'Solo se puede ajustar la prueba de una suscripción en periodo de prueba',
      );
    }

    const now = new Date();
    const newPeriodEnd =
      command.days === 0 ? now : addUtcDays(now, command.days);

    return this.subscriptions.adjustTrial({
      subscriptionId: current.id,
      adminId: command.adminId,
      note,
      periodStart: current.currentPeriodStart,
      previousPeriodEnd: current.currentPeriodEnd,
      newPeriodEnd,
      priceCop: current.plan.priceCop,
      currency: current.plan.currency,
      activatedAt: now,
    });
  }
}

/**
 * Aviso diario de vencimiento durante los cuatro días previos.
 * Idempotente por día: `expiry_notified_on` guarda la última fecha avisada.
 */
@Injectable()
export class SendExpiryRemindersUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
  ) {}

  async execute(now: Date = new Date()): Promise<number> {
    const windowEnd = new Date(now.getTime() + 4 * DAY_MS);
    const expiring = await this.subscriptions.listExpiring(now, windowEnd);
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    let sent = 0;
    for (const item of expiring) {
      const daysLeft = Math.max(0, Math.ceil((item.currentPeriodEnd.getTime() - now.getTime()) / DAY_MS));
      await this.mail.sendSubscriptionExpiryEmail({
        to: item.ownerEmail,
        name: item.ownerName,
        businessName: item.businessName,
        planName: item.planName,
        daysLeft,
        endsAt: item.currentPeriodEnd,
      });
      await this.subscriptions.markExpiryNotified(item.subscriptionId, today);
      sent += 1;
    }

    return sent;
  }
}
