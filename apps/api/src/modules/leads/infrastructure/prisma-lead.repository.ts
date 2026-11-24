 
import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service.js';
import { OutboxService } from '../../outbox/application/outbox.service.js';
import type { LeadStatusValue } from '../domain/lead.js';
import type {
  CreateLeadInput,
  LeadListQuery,
  LeadListResult,
  LeadRecord,
  LeadRecipientRecord,
  LeadRepository,
} from '../application/ports.js';

const leadSelect = {
  id: true,
  businessId: true,
  listingId: true,
  buyerName: true,
  buyerEmail: true,
  buyerPhone: true,
  message: true,
  status: true,
  source: true,
  consentAt: true,
  createdAt: true,
  expiresAt: true,
  listing: { select: { title: true } },
} satisfies Prisma.LeadSelect;

type LeadRow = Prisma.LeadGetPayload<{ select: typeof leadSelect }>;

function toRecord(row: LeadRow): LeadRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    listingId: row.listingId,
    listingTitle: row.listing?.title ?? null,
    buyerName: row.buyerName,
    buyerEmail: row.buyerEmail,
    buyerPhone: row.buyerPhone,
    message: row.message,
    status: row.status as LeadStatusValue,
    source: row.source,
    consentAt: row.consentAt,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

@Injectable()
export class PrismaLeadRepository implements LeadRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
  ) {}

  async findRecipient(businessId: string): Promise<LeadRecipientRecord | null> {
    const membership = await this.prisma.businessMembership.findFirst({
      where: { businessId, role: 'OWNER' },
      orderBy: { createdAt: 'asc' },
      select: {
        user: { select: { email: true, name: true } },
        business: { select: { name: true } },
      },
    });

    if (!membership) return null;
    return {
      email: membership.user.email,
      name: membership.user.name,
      businessName: membership.business.name,
    };
  }

  async createUnlessDuplicate(
    input: CreateLeadInput,
    duplicateSince: Date,
  ): Promise<{ created: boolean; lead: LeadRecord | null }> {
    const dedupeKey = input.listingId
      ? `${input.listingId}:${input.buyerEmail}`
      : `${input.businessId}:${input.buyerEmail}`;

    return this.prisma.$transaction(async (tx) => {
      // Bloqueo por par (publicación, correo): dos envíos simultáneos no pueden
      // crear duplicados. Se libera solo al terminar la transacción.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dedupeKey}))`;

      const duplicate = await tx.lead.findFirst({
        where: input.listingId
          ? {
              listingId: input.listingId,
              buyerEmail: input.buyerEmail,
              createdAt: { gte: duplicateSince },
            }
          : {
              businessId: input.businessId,
              listingId: null,
              buyerEmail: input.buyerEmail,
              createdAt: { gte: duplicateSince },
            },
        select: { id: true },
      });

      if (duplicate) return { created: false, lead: null };

      const row = await tx.lead.create({
        data: {
          businessId: input.businessId,
          listingId: input.listingId,
          buyerName: input.buyerName,
          buyerEmail: input.buyerEmail,
          buyerPhone: input.buyerPhone,
          message: input.message,
          source: input.source,
          consentAt: input.consentAt,
          ipHash: input.ipHash,
          createdAt: input.createdAt,
          expiresAt: input.expiresAt,
        },
        select: leadSelect,
      });

      await this.outbox.enqueue(tx, {
        type: 'LeadCreated',
        dedupeId: row.id,
        payload: {
          leadId: row.id,
          businessId: row.businessId,
          listingId: row.listingId,
          source: row.source,
          createdAt: row.createdAt.toISOString(),
        },
      });

      return { created: true, lead: toRecord(row) };
    });
  }

  async listByBusiness(query: LeadListQuery): Promise<LeadListResult> {
    const search = query.search?.trim();
    const where: Prisma.LeadWhereInput = {
      businessId: query.businessId,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { buyerName: { contains: search, mode: 'insensitive' } },
              { buyerEmail: { contains: search, mode: 'insensitive' } },
              { buyerPhone: { contains: search } },
            ],
          }
        : {}),
    };

    const [total, unreadCount, rows] = await this.prisma.$transaction([
      this.prisma.lead.count({ where }),
      this.prisma.lead.count({ where: { businessId: query.businessId, status: 'NEW' } }),
      this.prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: leadSelect,
      }),
    ]);

    return { items: rows.map(toRecord), total, unreadCount };
  }

  async findByIdForBusiness(leadId: string, businessId: string): Promise<LeadRecord | null> {
    const row = await this.prisma.lead.findFirst({
      where: { id: leadId, businessId },
      select: leadSelect,
    });
    return row ? toRecord(row) : null;
  }

  async markRead(leadId: string, businessId: string): Promise<LeadRecord | null> {
    await this.prisma.lead.updateMany({
      where: { id: leadId, businessId, status: 'NEW' },
      data: { status: 'READ' },
    });
    return this.findByIdForBusiness(leadId, businessId);
  }

  async setStatus(
    leadId: string,
    businessId: string,
    status: LeadStatusValue,
  ): Promise<LeadRecord | null> {
    await this.prisma.lead.updateMany({ where: { id: leadId, businessId }, data: { status } });
    return this.findByIdForBusiness(leadId, businessId);
  }
}
