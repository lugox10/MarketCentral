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
  VerticalRecord,
} from '../application/ports.js';
import type { BusinessStatus } from '../domain/business.js';

type BusinessRow = {
  id: string;
  name: string;
  slug: string;
  city: string;
  addressLine: string;
  whatsapp: string;
  verticalId: string;
  flaggedForReview: boolean;
  status: string;
  createdAt: Date;
  vertical?: { name: string } | null;
};

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
    currency: string;
    maxListings: number;
    maxCategories: number;
    featuredSlots: number;
    trialMonths: number;
    trialDays: number | null;
    billingPeriodDays: number | null;
    isActive: boolean;
  };
};

function toPlan(plan: SubscriptionWithPlan['plan']): PlanSummary {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    priceCop: plan.priceCop,
    currency: plan.currency,
    maxListings: plan.maxListings,
    maxCategories: plan.maxCategories,
    featuredSlots: plan.featuredSlots,
    trialMonths: plan.trialMonths,
    trialDays: plan.trialDays,
    billingPeriodDays: plan.billingPeriodDays,
    isActive: plan.isActive,
  };
}

function toProfile(business: BusinessRow): BusinessProfile {
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    city: business.city as BusinessProfile['city'],
    addressLine: business.addressLine,
    whatsapp: business.whatsapp,
    verticalId: business.verticalId,
    verticalName: business.vertical?.name ?? null,
    flaggedForReview: business.flaggedForReview,
    status: business.status as BusinessProfile['status'],
    createdAt: business.createdAt,
  };
}

function toSubscription(subscription: SubscriptionWithPlan | null): SubscriptionView | null {
  if (!subscription) return null;
  return {
    id: subscription.id,
    status: subscription.status as SubscriptionView['status'],
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    plan: toPlan(subscription.plan),
  };
}

/** Adaptador Prisma del puerto `BusinessRepository` (E2 + E5 fase 1). */
@Injectable()
export class PrismaBusinessRepository implements BusinessRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<BusinessContext | null> {
    const membership = await this.prisma.businessMembership.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        business: {
          include: { vertical: { select: { name: true } }, subscription: { include: { plan: true } } },
        },
      },
    });
    if (!membership) return null;

    return {
      business: toProfile(membership.business),
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
          fingerprint: input.fingerprint,
          verticalId: input.verticalId,
          ownerUserId: input.ownerUserId,
          flaggedForReview: input.flaggedForReview,
        },
        include: { vertical: { select: { name: true } } },
      });

      await tx.businessMembership.create({
        data: { businessId: business.id, userId: input.ownerUserId, role: 'OWNER' },
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
      business: toProfile(created.business),
      membershipRole: 'OWNER',
      subscription: toSubscription(created.subscription),
    };
  }

  async updateProfile(businessId: string, data: UpdateBusinessInput): Promise<BusinessProfile> {
    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data,
      include: { vertical: { select: { name: true } } },
    });
    return toProfile(updated);
  }

  async updateStatus(businessId: string, status: BusinessStatus): Promise<BusinessProfile> {
    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data: { status },
      include: { vertical: { select: { name: true } } },
    });
    return toProfile(updated);
  }

  async findById(businessId: string): Promise<BusinessProfile | null> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { vertical: { select: { name: true } } },
    });
    return business ? toProfile(business) : null;
  }

  async listAll(): Promise<BusinessWithOwner[]> {
    const businesses = await this.prisma.business.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        vertical: { select: { name: true } },
        subscription: { include: { plan: true } },
        memberships: {
          where: { role: 'OWNER' },
          take: 1,
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    return businesses.map((business) => ({
      ...toProfile(business),
      owner: business.memberships[0]?.user ?? null,
      subscriptionStatus: business.subscription?.status ?? null,
      planName: business.subscription?.plan.name ?? null,
    }));
  }

  async findVertical(verticalId: string): Promise<VerticalRecord | null> {
    return this.prisma.vertical.findUnique({ where: { id: verticalId } });
  }

  async findFirstActiveVertical(): Promise<VerticalRecord | null> {
    return this.prisma.vertical.findFirst({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  async countByOwner(userId: string): Promise<number> {
    return this.prisma.business.count({ where: { ownerUserId: userId } });
  }

  async lastCreatedAtByOwner(userId: string): Promise<Date | null> {
    const last = await this.prisma.business.findFirst({
      where: { ownerUserId: userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return last?.createdAt ?? null;
  }

  async findWhatsappInVertical(verticalId: string, whatsapp: string): Promise<boolean> {
    const found = await this.prisma.business.findFirst({
      where: { verticalId, whatsapp },
      select: { id: true },
    });
    return found !== null;
  }

  async listFingerprints(verticalId: string): Promise<string[]> {
    const rows = await this.prisma.business.findMany({
      where: { verticalId },
      select: { fingerprint: true },
    });
    return rows.map((row) => row.fingerprint);
  }

  async countActiveListings(businessId: string): Promise<number> {
    // Las publicaciones llegan en la fase 3; hasta entonces el cupo es 0.
    const delegate = (this.prisma as unknown as { listing?: { count: (args: unknown) => Promise<number> } })
      .listing;
    if (!delegate) return 0;
    return delegate.count({ where: { businessId, status: { in: ['DRAFT', 'PUBLISHED', 'PAUSED'] } } });
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
    return plan ? toPlan(plan) : null;
  }
}
