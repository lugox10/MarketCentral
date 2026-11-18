import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { NOTE_MAX_LENGTH, PLAN_CODES, SUBSCRIPTION_STATUSES } from '../domain/subscription.js';
import type { PlanCode, SubscriptionStatus } from '../domain/subscription.js';

/** Cuerpo de `POST /admin/subscriptions/:businessId/activate`. */
export class ActivateSubscriptionDto {
  @ApiProperty({ format: 'uuid', description: 'Plan pagado (BASE o PRO)' })
  @IsUUID()
  planId!: string;

  @ApiProperty({
    example: 'Pago verificado externamente por transferencia. Referencia 12345.',
    maxLength: NOTE_MAX_LENGTH,
    description: 'Nota de verificación del pago. Obligatoria, máximo 500 caracteres.',
  })
  @IsString()
  @Length(1, NOTE_MAX_LENGTH)
  note!: string;
}

/** Filtros y paginación del listado administrativo. */
export class ListAdminSubscriptionsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: SUBSCRIPTION_STATUSES })
  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUSES)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ enum: PLAN_CODES })
  @IsOptional()
  @IsIn(PLAN_CODES)
  plan?: PlanCode;

  @ApiPropertyOptional({ description: 'Búsqueda por nombre de negocio', maxLength: 80 })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  q?: string;
}

/** Cuerpo de `PATCH /admin/plans/:id`. Todos los campos son opcionales. */
export class UpdatePlanDto {
  @ApiPropertyOptional({ minimum: 0, example: 30000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceCop?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1000, example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  maxListings?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1000, example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  maxCategories?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1000, example: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  featuredSlots?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 12, example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(12)
  trialMonths?: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 90,
    description: 'Si se define, sustituye a los meses de prueba',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  trialDays?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1, maximum: 366, example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(366)
  billingPeriodDays?: number | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Cuerpo de `PATCH /admin/subscriptions/:businessId/trial`. */
export class AdjustTrialDto {
  @ApiProperty({
    type: Number,
    enum: [0, 5, 15, 20],
    example: 5,
    description: 'Días de prueba restantes; 0 revoca la prueba',
  })
  @IsIn([0, 5, 15, 20])
  days!: number;

  @ApiProperty({
    example: 'Se acorta la prueba por solicitud del negocio.',
    maxLength: NOTE_MAX_LENGTH,
  })
  @IsString()
  @Length(1, NOTE_MAX_LENGTH)
  note!: string;
}
