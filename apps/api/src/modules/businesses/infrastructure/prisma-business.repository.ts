import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  BusinessContext,
  BusinessProfile,
  BusinessRepository,
  BusinessWithOwner,
  CreateBusinessInput,
  PlanRepository,
  PlanSummary,
  SubscriptionView,
  UpdateBusinessInput,
} from '../application/ports.js';
import type { BusinessStatus } from '../domain/business.js';

type SubscriptionWithPlan = {
  id: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  plan: {
    id: string;
    code: string;
    name: string;
    priceCop: number;
    intervalMonths: number;
    trialDays: number;
  };
};

function toSubscription(subscription: SubscriptionWithPlan | null): SubscriptionView | null {
  if (!subscription) return null;
  return {
    id: subscription.id,
    status: subscription.status as SubscriptionView['status'],
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    plan: {
      id: subscription.plan.id,
      code: subscription.plan.code,
      name: subscription.plan.name,
      priceCop: subscription.plan.priceCop,
      intervalMonths: subscription.plan.intervalMonths,
      trialDays: subscription.plan.trialDays,
    },
  };
}

/** Adaptador Prisma del puerto `BusinessRepository` (E2). */
@Injectable()
export class PrismaBusinessRepository implements BusinessRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<BusinessContext | null> {
    const membership = await this.prisma.businessMembership.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        business: { include: { subscription: { include: { plan: true } } } },
      },
    });
    if (!membership) return null;

    return {
      business: membership.business,
      membershipRole: membership.role,
      subscription: toSubscription(membership.business.subscription),
    };
  }

  async createWithOwner(input: CreateBusinessInput): Promise<BusinessContext> {
    const created = await this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: input.name,
          slug: input.slug,
          city: input.city,
          addressLine: input.addressLine,
          whatsapp: input.whatsapp,
        },
      });

      await tx.businessMembership.create({
        data: { businessId: business.id, userId: input.userId, role: 'OWNER' },
      });

      const subscription = await tx.subscription.create({
        data: {
          businessId: business.id,
          planId: input.planId,
          status: input.subscriptionStatus,
          currentPeriodStart: input.now,
          currentPeriodEnd: input.periodEnd,
        },
        include: { plan: true },
      });

      return { business, subscription };
    });

    return {
      business: created.business,
      membershipRole: 'OWNER',
      subscription: toSubscription(created.subscription),
    };
  }

  async updateProfile(businessId: string, data: UpdateBusinessInput): Promise<BusinessProfile> {
    return this.prisma.business.update({ where: { id: businessId }, data });
  }

  async updateStatus(businessId: string, status: BusinessStatus): Promise<BusinessProfile> {
    return this.prisma.business.update({ where: { id: businessId }, data: { status } });
  }

  async findById(businessId: string): Promise<BusinessProfile | null> {
    return this.prisma.business.findUnique({ where: { id: businessId } });
  }

  async listAll(): Promise<BusinessWithOwner[]> {
    const businesses = await this.prisma.business.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: { include: { plan: true } },
        memberships: {
          where: { role: 'OWNER' },
          take: 1,
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    return businesses.map((business) => ({
      id: business.id,
      name: business.name,
      slug: business.slug,
      city: business.city,
      addressLine: business.addressLine,
      whatsapp: business.whatsapp,
      status: business.status,
      createdAt: business.createdAt,
      owner: business.memberships[0]?.user ?? null,
      subscriptionStatus: business.subscription?.status ?? null,
      planName: business.subscription?.plan.name ?? null,
    }));
  }
}

/** Adaptador Prisma del catálogo de planes. */
@Injectable()
export class PrismaPlanRepository implements PlanRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByCode(code: string): Promise<PlanSummary | null> {
    const plan = await this.prisma.plan.findUnique({
      where: { code: code as 'FREE' | 'BASE' | 'PRO' },
    });
    if (!plan) return null;
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      priceCop: plan.priceCop,
      intervalMonths: plan.intervalMonths,
      trialDays: plan.trialDays,
    };
  }
}
