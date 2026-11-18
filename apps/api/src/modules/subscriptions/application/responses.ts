import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PLAN_CODES, SUBSCRIPTION_STATUSES } from '../domain/subscription.js';
import type { ActivationRecord, PlanRecord, SubscriptionRecord } from './ports.js';
import { effectiveStatus, isExpired, remainingDays } from '../domain/subscription.js';

export class PlanResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: PLAN_CODES, example: 'FREE' })
  code!: string;

  @ApiProperty({ example: 'Free' })
  name!: string;

  @ApiProperty({ type: Number, example: 0, description: 'Precio en pesos colombianos enteros' })
  priceCop!: number;

  @ApiProperty({ type: String, example: 'COP' })
  currency!: string;

  @ApiProperty({ type: Number, example: 10 })
  maxListings!: number;

  @ApiProperty({ type: Number, example: 3, description: 'Categorías propias incluidas' })
  maxCategories!: number;

  @ApiProperty({ type: Number, example: 6, description: 'Destacados simultáneos' })
  featuredSlots!: number;

  @ApiProperty({
    type: Number,
    example: 2,
    description: 'Meses calendario de prueba (0 si no aplica)',
  })
  trialMonths!: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: null,
    description: 'Días de prueba que sustituyen a los meses cuando están definidos',
  })
  trialDays!: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 30,
    description: 'Días que agrega una activación pagada',
  })
  billingPeriodDays!: number | null;

  @ApiProperty({ type: Boolean, example: true })
  isActive!: boolean;
}

export class BusinessRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Prendería La 70' })
  name!: string;
}

export class ActivationSummaryDto {
  @ApiProperty({ type: String, format: 'date-time' })
  activatedAt!: Date;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Super Admin' })
  adminName!: string | null;

  @ApiProperty({ type: String })
  note!: string;

  @ApiProperty({ type: String, example: 'ACTIVATED' })
  kind!: string;
}

export class ActivationDetailDto extends ActivationSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, example: 'BASE' })
  planCode!: string;

  @ApiProperty({ type: String, example: 'Base' })
  planName!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  periodStart!: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  previousPeriodEnd!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  newPeriodEnd!: Date;

  @ApiProperty({ type: Number, example: 30000 })
  priceCop!: number;

  @ApiProperty({ type: String, example: 'COP' })
  currency!: string;
}

export class MySubscriptionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: BusinessRefDto })
  business!: BusinessRefDto;

  @ApiProperty({ type: PlanResponseDto })
  plan!: PlanResponseDto;

  @ApiProperty({ enum: SUBSCRIPTION_STATUSES, example: 'TRIALING' })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  currentPeriodStart!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  currentPeriodEnd!: Date;

  @ApiProperty({ type: Number, example: 61 })
  remainingDays!: number;

  @ApiProperty({ type: Boolean, example: false })
  isExpired!: boolean;

  @ApiPropertyOptional({ type: ActivationSummaryDto, nullable: true })
  lastActivation!: ActivationSummaryDto | null;
}

export class AdminSubscriptionRowDto extends MySubscriptionResponseDto {
  @ApiProperty({ format: 'uuid' })
  businessId!: string;

  @ApiProperty({ type: String, example: 'Prendería La 70' })
  businessName!: string;
}

export class AdminSubscriptionPageDto {
  @ApiProperty({ type: AdminSubscriptionRowDto, isArray: true })
  items!: AdminSubscriptionRowDto[];

  @ApiProperty({ type: Number, example: 1 })
  page!: number;

  @ApiProperty({ type: Number, example: 20 })
  limit!: number;

  @ApiProperty({ type: Number, example: 3 })
  total!: number;

  @ApiProperty({ type: Number, example: 1 })
  totalPages!: number;
}

export class ActivateSubscriptionResponseDto {
  @ApiProperty({ type: MySubscriptionResponseDto })
  subscription!: MySubscriptionResponseDto;

  @ApiProperty({ type: ActivationDetailDto })
  activation!: ActivationDetailDto;

  @ApiProperty({
    type: Boolean,
    example: false,
    description: 'true cuando la misma Idempotency-Key devuelve el resultado ya aplicado',
  })
  replayed!: boolean;
}

export function toPlanResponse(plan: PlanRecord): PlanResponseDto {
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

export function toActivationSummary(
  activation: ActivationRecord | null,
): ActivationSummaryDto | null {
  if (!activation) return null;
  return {
    activatedAt: activation.activatedAt,
    adminName: activation.adminName,
    note: activation.note,
    kind: activation.kind,
  };
}

export function toActivationDetail(activation: ActivationRecord): ActivationDetailDto {
  return {
    ...toActivationSummary(activation)!,
    id: activation.id,
    planCode: activation.planCode,
    planName: activation.planName,
    periodStart: activation.periodStart,
    previousPeriodEnd: activation.previousPeriodEnd,
    newPeriodEnd: activation.newPeriodEnd,
    priceCop: activation.priceCop,
    currency: activation.currency,
  };
}

export function toMySubscription(
  subscription: SubscriptionRecord,
  now: Date,
): MySubscriptionResponseDto {
  return {
    id: subscription.id,
    business: { id: subscription.businessId, name: subscription.businessName },
    plan: toPlanResponse(subscription.plan),
    status: effectiveStatus(subscription.status, subscription.currentPeriodEnd, now),
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    remainingDays: remainingDays(subscription.currentPeriodEnd, now),
    isExpired: isExpired(subscription.currentPeriodEnd, now),
    lastActivation: toActivationSummary(subscription.lastActivation),
  };
}

export function toAdminRow(subscription: SubscriptionRecord, now: Date): AdminSubscriptionRowDto {
  return {
    ...toMySubscription(subscription, now),
    businessId: subscription.businessId,
    businessName: subscription.businessName,
  };
}
