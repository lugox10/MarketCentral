import { ApiProperty } from '@nestjs/swagger';

import type { LeadRecord } from './ports.js';
import type { LeadStatusValue, LeadSourceValue } from '../domain/lead.js';

export class LeadResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  listingId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  listingTitle!: string | null;

  @ApiProperty({ type: String })
  buyerName!: string;

  @ApiProperty({ type: String })
  buyerEmail!: string;

  @ApiProperty({ type: String })
  buyerPhone!: string;

  @ApiProperty({ type: String })
  message!: string;

  @ApiProperty({ type: String, enum: ['NEW', 'READ', 'REPLIED', 'ARCHIVED', 'SPAM'] })
  status!: LeadStatusValue;

  @ApiProperty({ type: String, enum: ['LISTING', 'BUSINESS_PROFILE'] })
  source!: LeadSourceValue;

  @ApiProperty({ type: String, format: 'date-time' })
  consentAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: string;
}

export class LeadListResponseDto {
  @ApiProperty({ type: () => [LeadResponseDto] })
  items!: LeadResponseDto[];

  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  limit!: number;

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: Number })
  totalPages!: number;

  @ApiProperty({ type: Number })
  unreadCount!: number;
}

export class LeadSummaryResponseDto {
  @ApiProperty({ type: Number })
  unreadCount!: number;

  @ApiProperty({ type: Number })
  total!: number;
}

export class CreatePublicLeadResponseDto {
  @ApiProperty({ type: Boolean })
  ok!: boolean;

  @ApiProperty({ type: String })
  message!: string;
}

export class FormTokenResponseDto {
  @ApiProperty({ type: String })
  token!: string;

  @ApiProperty({ type: Number, description: 'Segundos mínimos antes de poder enviar' })
  minSeconds!: number;

  @ApiProperty({ type: Number, description: 'Segundos de validez del token' })
  ttlSeconds!: number;
}

export function toLeadResponse(lead: LeadRecord): LeadResponseDto {
  return {
    id: lead.id,
    listingId: lead.listingId,
    listingTitle: lead.listingTitle,
    buyerName: lead.buyerName,
    buyerEmail: lead.buyerEmail,
    buyerPhone: lead.buyerPhone,
    message: lead.message,
    status: lead.status,
    source: lead.source,
    consentAt: lead.consentAt.toISOString(),
    createdAt: lead.createdAt.toISOString(),
    expiresAt: lead.expiresAt.toISOString(),
  };
}
