import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  BusinessModerationTarget,
  CreateReportInput,
  ListingModerationTarget,
  ModerationRepository,
  ModerationSummary,
  ReportListQuery,
  ReportListResult,
  ReportRecord,
} from '../application/ports.js';
import type { ReportStatus } from '../domain/report.js';

const reportInclude = {
  business: { select: { id: true, name: true, slug: true, status: true } },
  listing: { select: { id: true, title: true, slug: true, status: true } },
  resolver: { select: { name: true } },
} satisfies Prisma.ReportInclude;

type ReportRow = Prisma.ReportGetPayload<{ include: typeof reportInclude }>;

@Injectable()
export class PrismaModerationRepository implements ModerationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createUnlessDuplicate(input: CreateReportInput): Promise<ReportRecord | null> {
    const scope = input.listingId ? `listing:${input.listingId}` : `business:${input.businessId}`;
    const lockKey = `${scope}:${input.ipHash}:${input.reason}`;

    return this.prisma.$transaction(async (tx) => {
      // Serializa denuncias idénticas concurrentes de la misma IP; sin esto dos
      // peticiones simultáneas podrían pasar el `findFirst` a la vez.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const duplicate = await tx.report.findFirst({
        where: {
          reporterIpHash: input.ipHash,
          reason: input.reason,
          businessId: input.businessId,
          listingId: input.listingId,
          createdAt: { gte: input.duplicateSince },
        },
        select: { id: true },
      });
      if (duplicate) return null;

      const created = await tx.report.create({
        data: {
          businessId: input.businessId,
          listingId: input.listingId,
          reason: input.reason,
          details: input.details,
          reporterEmail: input.reporterEmail,
          reporterUserId: input.reporterUserId,
          reporterIpHash: input.ipHash,
        },
        include: reportInclude,
      });

      return toRecord(created);
    });
  }

  async list(query: ReportListQuery): Promise<ReportListResult> {
    const where: Prisma.ReportWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.reason ? { reason: query.reason } : {}),
      ...(query.search
        ? {
            OR: [
              { business: { name: { contains: query.search, mode: 'insensitive' } } },
              { listing: { title: { contains: query.search, mode: 'insensitive' } } },
              { reporterEmail: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        include: reportInclude,
        orderBy: [{ createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      items: rows.map(toRecord),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async findById(reportId: string): Promise<ReportRecord | null> {
    const row = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: reportInclude,
    });
    return row ? toRecord(row) : null;
  }

  async setStatus(input: {
    reportId: string;
    status: ReportStatus;
    note: string | null;
    resolvedByAdminId: string;
    resolvedAt: Date | null;
  }): Promise<ReportRecord> {
    const row = await this.prisma.report.update({
      where: { id: input.reportId },
      data: {
        status: input.status,
        resolutionNote: input.note,
        resolvedByAdminId: input.resolvedByAdminId,
        resolvedAt: input.resolvedAt,
      },
      include: reportInclude,
    });
    return toRecord(row);
  }

  async findBusiness(businessId: string): Promise<BusinessModerationTarget | null> {
    return this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, slug: true, status: true },
    });
  }

  async findListing(listingId: string): Promise<ListingModerationTarget | null> {
    const row = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        businessId: true,
        business: { select: { name: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      businessId: row.businessId,
      businessName: row.business.name,
    };
  }

  async setBusinessStatus(businessId: string, status: 'APPROVED' | 'SUSPENDED'): Promise<void> {
    await this.prisma.business.update({ where: { id: businessId }, data: { status } });
  }

  async archiveListing(listingId: string): Promise<void> {
    await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: 'ARCHIVED', archivedAt: new Date(), featured: false, featuredAt: null },
    });
  }

  async logAction(input: {
    actorUserId: string;
    reportId: string | null;
    businessId: string | null;
    listingId: string | null;
    kind:
      'REPORT_STATUS_CHANGED' | 'BUSINESS_SUSPENDED' | 'BUSINESS_REACTIVATED' | 'LISTING_ARCHIVED';
    reason: string;
  }): Promise<void> {
    await this.prisma.moderationAction.create({
      data: {
        actorUserId: input.actorUserId,
        reportId: input.reportId,
        businessId: input.businessId,
        listingId: input.listingId,
        kind: input.kind,
        reason: input.reason.slice(0, 500),
      },
    });
  }

  async summary(): Promise<ModerationSummary> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [pending, reviewed, resolvedToday, suspendedBusinesses] = await this.prisma.$transaction([
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.report.count({ where: { status: 'REVIEWED' } }),
      this.prisma.report.count({
        where: { status: 'RESOLVED', resolvedAt: { gte: startOfDay } },
      }),
      this.prisma.business.count({ where: { status: 'SUSPENDED' } }),
    ]);

    return { pending, reviewed, resolvedToday, suspendedBusinesses };
  }
}

function toRecord(row: ReportRow): ReportRecord {
  return {
    id: row.id,
    reason: row.reason as ReportRecord['reason'],
    details: row.details,
    status: row.status as ReportRecord['status'],
    reporterEmail: row.reporterEmail,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    resolutionNote: row.resolutionNote,
    resolvedBy: row.resolver?.name ?? null,
    businessId: row.business.id,
    businessName: row.business.name,
    businessSlug: row.business.slug,
    businessStatus: row.business.status as ReportRecord['businessStatus'],
    listingId: row.listing?.id ?? null,
    listingTitle: row.listing?.title ?? null,
    listingSlug: row.listing?.slug ?? null,
    listingStatus: row.listing?.status ?? null,
  };
}
