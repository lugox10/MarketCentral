import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { ModerationSummary, ReportListResult, ReportRecord } from './ports.js';
import type { ReportReason, ReportStatus } from '../domain/report.js';

export class ReportListingRefDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  slug!: string;

  @ApiProperty({ type: String })
  status!: string;
}

export class ReportBusinessRefDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  slug!: string;

  @ApiProperty({ type: String })
  status!: string;
}

export class ReportResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({
    type: String,
    enum: ['SCAM', 'STOLEN', 'INAPPROPRIATE', 'WRONG_CATEGORY', 'OTHER'],
  })
  reason!: ReportReason;

  @ApiProperty({ type: String, nullable: true })
  details!: string | null;

  @ApiProperty({ type: String, enum: ['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'] })
  status!: ReportStatus;

  @ApiProperty({ type: String, nullable: true })
  reporterEmail!: string | null;

  @ApiProperty({ type: Date })
  createdAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  resolvedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true })
  resolutionNote!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  resolvedBy?: string | null;

  @ApiProperty({ type: ReportBusinessRefDto })
  business!: ReportBusinessRefDto;

  @ApiPropertyOptional({ type: ReportListingRefDto, nullable: true })
  listing?: ReportListingRefDto | null;
}

export class ReportPageResponseDto {
  @ApiProperty({ type: [ReportResponseDto] })
  items!: ReportResponseDto[];

  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  limit!: number;

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: Number })
  totalPages!: number;
}

export class ModerationSummaryResponseDto {
  @ApiProperty({ type: Number })
  pending!: number;

  @ApiProperty({ type: Number })
  reviewed!: number;

  @ApiProperty({ type: Number })
  resolvedToday!: number;

  @ApiProperty({ type: Number })
  suspendedBusinesses!: number;
}

export class CreateReportResponseDto {
  @ApiProperty({ type: Boolean })
  ok!: boolean;

  @ApiProperty({ type: String })
  message!: string;
}

export class ModerationActionResponseDto {
  @ApiProperty({ type: Boolean })
  ok!: boolean;

  @ApiProperty({ type: String })
  message!: string;

  @ApiProperty({ type: ReportResponseDto })
  report!: ReportResponseDto;
}

export function toReportResponse(record: ReportRecord): ReportResponseDto {
  return {
    id: record.id,
    reason: record.reason,
    details: record.details,
    status: record.status,
    reporterEmail: record.reporterEmail,
    createdAt: record.createdAt,
    resolvedAt: record.resolvedAt,
    resolutionNote: record.resolutionNote,
    resolvedBy: record.resolvedBy,
    business: {
      id: record.businessId,
      name: record.businessName,
      slug: record.businessSlug,
      status: record.businessStatus,
    },
    listing: record.listingId
      ? {
          id: record.listingId,
          title: record.listingTitle ?? '',
          slug: record.listingSlug ?? '',
          status: record.listingStatus ?? '',
        }
      : null,
  };
}

export function toReportPage(result: ReportListResult): ReportPageResponseDto {
  return {
    items: result.items.map(toReportResponse),
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
  };
}

export function toSummaryResponse(summary: ModerationSummary): ModerationSummaryResponseDto {
  return {
    pending: summary.pending,
    reviewed: summary.reviewed,
    resolvedToday: summary.resolvedToday,
    suspendedBusinesses: summary.suspendedBusinesses,
  };
}
