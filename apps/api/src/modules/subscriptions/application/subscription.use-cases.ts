import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { addCalendarMonths } from '../../../common/utils/dates.js';
import type { BusinessRepository } from '../../businesses/application/ports.js';
import { BUSINESS_REPOSITORY } from '../../businesses/application/tokens.js';
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
