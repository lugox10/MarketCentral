import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  ActivationRecord,
  ActivationResult,
  ActivateSubscriptionInput,
  AdminSubscriptionPage,
  AdminSubscriptionQuery,
  EnsureFreeSubscriptionInput,
  PlanRecord,
  SubscriptionRecord,
  SubscriptionRepository,
} from '../application/ports.js';
import type { ActivationKind, SubscriptionStatus } from '../domain/subscription.js';
import { effectiveStatus } from '../domain/subscription.js';
import { SubscriptionError } from '../domain/subscription-error.js';

const planSelect = {
  id: true,
  code: true,
  name: true,
  priceCop: true,
  currency: true,
  maxListings: true,
  trialMonths: true,
  billingPeriodDays: true,
  isActive: true,
} as const;

const activationInclude = {
  plan: { select: { code: true, name: true } },
  activatedBy: { select: { name: true } },
} as const;

const subscriptionInclude = {
  plan: { select: planSelect },
  business: { select: { name: true } },
  activations: {
    orderBy: { activatedAt: 'desc' },
    take: 1,
    include: activationInclude,
  },
} as const;

type PlanRow = Prisma.PlanGetPayload<{ select: typeof planSelect }>;
type ActivationRow = Prisma.SubscriptionActivationGetPayload<{ include: typeof activationInclude }>;
type SubscriptionRow = Prisma.SubscriptionGetPayload<{ include: typeof subscriptionInclude }>;

/** Colisión del índice único (Prisma P2002), sin acoplar la aplicación a Prisma. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
  );
}

function toPlan(row: PlanRow): PlanRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    priceCop: row.priceCop,
    currency: row.currency,
    maxListings: row.maxListings,
    trialMonths: row.trialMonths,
    billingPeriodDays: row.billingPeriodDays,
    isActive: row.isActive,
  };
}

function toActivation(row: ActivationRow): ActivationRecord {
  return {
    id: row.id,
    kind: row.kind as ActivationKind,
    note: row.note,
    activatedAt: row.activatedAt,
    periodStart: row.periodStart,
    previousPeriodEnd: row.previousPeriodEnd,
    newPeriodEnd: row.newPeriodEnd,
    priceCop: row.priceCop,
    currency: row.currency,
    planCode: row.plan.code,
    planName: row.plan.name,
    adminName: row.activatedBy?.name ?? null,
  };
}

function toSubscription(row: SubscriptionRow, now: Date): SubscriptionRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    businessName: row.business.name,
    status: effectiveStatus(row.status as SubscriptionStatus, row.currentPeriodEnd, now),
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    plan: toPlan(row.plan),
    lastActivation: row.activations[0] ? toActivation(row.activations[0]) : null,
  };
}

/** Adaptador Prisma del puerto `SubscriptionRepository` (E4). */
@Injectable()
export class PrismaSubscriptionRepository implements SubscriptionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findPlans(): Promise<PlanRecord[]> {
    const rows = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ priceCop: 'asc' }, { name: 'asc' }],
      select: planSelect,
    });
    return rows.map(toPlan);
  }

  async findPlanById(planId: string): Promise<PlanRecord | null> {
    const row = await this.prisma.plan.findUnique({ where: { id: planId }, select: planSelect });
    return row ? toPlan(row) : null;
  }

  async findPlanByCode(code: string): Promise<PlanRecord | null> {
    const row = await this.prisma.plan.findUnique({
      where: { code: code as 'FREE' | 'BASE' | 'PRO' },
      select: planSelect,
    });
    return row ? toPlan(row) : null;
  }

  async findByBusinessId(businessId: string): Promise<SubscriptionRecord | null> {
    const row = await this.prisma.subscription.findUnique({
      where: { businessId },
      include: subscriptionInclude,
    });
    return row ? toSubscription(row, new Date()) : null;
  }

  /** Solo para la regularización de un negocio sin suscripción. Idempotente. */
  async ensureFreeSubscription(input: EnsureFreeSubscriptionInput): Promise<SubscriptionRecord> {
    const existing = await this.findByBusinessId(input.businessId);
    if (existing) return existing;

    try {
      await this.prisma.subscription.create({
        data: {
          businessId: input.businessId,
          planId: input.planId,
          status: 'TRIALING',
          currentPeriodStart: input.periodStart,
          currentPeriodEnd: input.periodEnd,
        },
      });
    } catch (error: unknown) {
      if (!isUniqueViolation(error)) throw error;
      // Otra petición concurrente ya la creó: se reutiliza.
    }

    const created = await this.findByBusinessId(input.businessId);
    if (!created) {
      throw new SubscriptionError(
        'SUBSCRIPTION_NOT_FOUND',
        'No fue posible inicializar la suscripción del negocio',
      );
    }
    return created;
  }

  async expireOverdue(now: Date): Promise<number> {
    const result = await this.prisma.subscription.updateMany({
      where: {
        status: { in: ['TRIALING', 'ACTIVE'] },
        currentPeriodEnd: { lte: now },
      },
      data: { status: 'EXPIRED' },
    });
    return result.count;
  }

  async listAdmin(query: AdminSubscriptionQuery): Promise<AdminSubscriptionPage> {
    const where: Prisma.SubscriptionWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.planCode) where.plan = { code: query.planCode as 'FREE' | 'BASE' | 'PRO' };
    if (query.search) {
      where.business = { name: { contains: query.search, mode: 'insensitive' } };
    }

    const now = new Date();
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.subscription.count({ where }),
      this.prisma.subscription.findMany({
        where,
        include: subscriptionInclude,
        orderBy: [{ business: { name: 'asc' } }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return { items: rows.map((row) => toSubscription(row, now)), total };
  }

  async history(businessId: string): Promise<ActivationRecord[]> {
    const rows = await this.prisma.subscriptionActivation.findMany({
      where: { subscription: { businessId } },
      orderBy: { activatedAt: 'desc' },
      include: activationInclude,
    });
    return rows.map(toActivation);
  }

  async activate(input: ActivateSubscriptionInput): Promise<ActivationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (input.idempotencyKey) {
          const already = await tx.subscriptionActivation.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
            include: activationInclude,
          });
          if (already) {
            return this.replay(tx, already, input);
          }
        }

        await tx.subscription.update({
          where: { id: input.subscriptionId },
          data: {
            planId: input.plan.id,
            status: 'ACTIVE',
            currentPeriodStart: input.periodStart,
            currentPeriodEnd: input.newPeriodEnd,
            activatedByAdminId: input.adminId,
            activationNote: input.note,
          },
        });

        const activation = await tx.subscriptionActivation.create({
          data: {
            subscriptionId: input.subscriptionId,
            planId: input.plan.id,
            activatedByAdminId: input.adminId,
            kind: input.kind,
            note: input.note,
            activatedAt: input.activatedAt,
            periodStart: input.periodStart,
            previousPeriodEnd: input.previousPeriodEnd,
            newPeriodEnd: input.newPeriodEnd,
            priceCop: input.plan.priceCop,
            currency: input.plan.currency,
            idempotencyKey: input.idempotencyKey,
            requestHash: input.requestHash,
          },
          include: activationInclude,
        });

        const subscription = await tx.subscription.findUnique({
          where: { id: input.subscriptionId },
          include: subscriptionInclude,
        });
        if (!subscription) {
          throw new SubscriptionError(
            'SUBSCRIPTION_NOT_FOUND',
            'La suscripción desapareció durante la activación',
          );
        }

        return {
          subscription: toSubscription(subscription, input.activatedAt),
          activation: toActivation(activation),
          replayed: false,
        };
      });
    } catch (error: unknown) {
      // Carrera entre dos peticiones con la misma Idempotency-Key: la segunda
      // choca con el índice único y devuelve el resultado de la primera.
      if (isUniqueViolation(error) && input.idempotencyKey) {
        const already = await this.prisma.subscriptionActivation.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: activationInclude,
        });
        if (already) {
          const subscription = await this.prisma.subscription.findUnique({
            where: { id: input.subscriptionId },
            include: subscriptionInclude,
          });
          if (subscription) {
            if (already.requestHash !== input.requestHash) {
              throw new SubscriptionError(
                'IDEMPOTENCY_CONFLICT',
                'La Idempotency-Key ya se usó con otra activación',
              );
            }
            return {
              subscription: toSubscription(subscription, input.activatedAt),
              activation: toActivation(already),
              replayed: true,
            };
          }
        }
      }
      throw error;
    }
  }

  private async replay(
    tx: Prisma.TransactionClient,
    activation: ActivationRow,
    input: ActivateSubscriptionInput,
  ): Promise<ActivationResult> {
    if (activation.requestHash !== input.requestHash) {
      throw new SubscriptionError(
        'IDEMPOTENCY_CONFLICT',
        'La Idempotency-Key ya se usó con otra activación',
      );
    }
    const subscription = await tx.subscription.findUnique({
      where: { id: activation.subscriptionId },
      include: subscriptionInclude,
    });
    if (!subscription) {
      throw new SubscriptionError('SUBSCRIPTION_NOT_FOUND', 'La suscripción no existe');
    }
    return {
      subscription: toSubscription(subscription, input.activatedAt),
      activation: toActivation(activation),
      replayed: true,
    };
  }
}
