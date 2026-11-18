import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { AMVA_CITIES, BUSINESS_STATUSES, SUBSCRIPTION_STATUSES } from '../domain/business.js';

/** Proyección del negocio que devuelve la API (sin campos internos). */
export class BusinessResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, example: 'Prendería La 70' })
  name!: string;

  @ApiProperty({ type: String, example: 'prenderya-la-70' })
  slug!: string;

  @ApiProperty({ type: String, enum: AMVA_CITIES, example: 'MEDELLIN' })
  city!: string;

  @ApiProperty({ type: String, example: 'Calle 70 # 45-12' })
  addressLine!: string;

  @ApiProperty({ type: String, example: '+573001234567' })
  whatsapp!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  verticalId!: string;

  @ApiPropertyOptional({ type: String, example: 'Prenderías', nullable: true })
  verticalName!: string | null;

  @ApiProperty({ type: Boolean, example: false })
  flaggedForReview!: boolean;

  @ApiProperty({ type: String, enum: BUSINESS_STATUSES, example: 'APPROVED' })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class PlanResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, example: 'FREE' })
  code!: string;

  @ApiProperty({ type: String, example: 'Free' })
  name!: string;

  @ApiProperty({ type: Number, example: 0 })
  priceCop!: number;

  @ApiProperty({ type: String, example: 'COP' })
  currency!: string;

  @ApiProperty({ type: Number, example: 10 })
  maxListings!: number;

  @ApiProperty({ type: Number, example: 3, description: 'Categorías propias incluidas' })
  maxCategories!: number;

  @ApiProperty({ type: Number, example: 3, description: 'Destacados simultáneos' })
  featuredSlots!: number;

  @ApiProperty({ type: Number, example: 2, description: 'Meses calendario de prueba; 0 = sin prueba' })
  trialMonths!: number;

  @ApiProperty({ type: Number, nullable: true, example: null })
  trialDays!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 30 })
  billingPeriodDays!: number | null;

  @ApiProperty({ type: Boolean, example: true })
  isActive!: boolean;
}

export class SubscriptionResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, enum: SUBSCRIPTION_STATUSES, example: 'TRIALING' })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  currentPeriodStart!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  currentPeriodEnd!: Date;

  @ApiProperty({ type: PlanResponseDto })
  plan!: PlanResponseDto;
}

export class MyBusinessResponseDto {
  @ApiProperty({ type: BusinessResponseDto })
  business!: BusinessResponseDto;

  @ApiProperty({ type: String, enum: ['OWNER', 'MANAGER', 'STAFF'], example: 'OWNER' })
  membershipRole!: string;

  @ApiPropertyOptional({ type: SubscriptionResponseDto, nullable: true })
  subscription!: SubscriptionResponseDto | null;
}

export class AdminBusinessRowDto extends BusinessResponseDto {
  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    example: { id: 'uuid', name: 'Ana Pérez', email: 'ana@example.com' },
  })
  owner!: { id: string; name: string; email: string } | null;

  @ApiPropertyOptional({ type: String, enum: SUBSCRIPTION_STATUSES, nullable: true })
  subscriptionStatus!: string | null;

  @ApiPropertyOptional({ type: String, example: 'Free', nullable: true })
  planName!: string | null;
}
