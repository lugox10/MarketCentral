import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
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
