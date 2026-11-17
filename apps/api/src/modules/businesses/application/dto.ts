import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
  ValidateIf,
} from 'class-validator';

import {
  AMVA_CITIES,
  type AmvaCity,
  BUSINESS_STATUSES,
  type BusinessStatus,
} from '../domain/business.js';

const WHATSAPP_PATTERN = /^(\+?57)?[\s-]?3\d{2}[\s-]?\d{3}[\s-]?\d{4}$/;

export class CreateBusinessDto {
  // AGREGADO: type: String
  @ApiProperty({ type: String, example: 'Prendería La 70', minLength: 2, maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  // AGREGADO: type: String
  @ApiProperty({ type: String, enum: AMVA_CITIES, example: 'MEDELLIN' })
  @IsIn(AMVA_CITIES)
  city!: AmvaCity;

  // AGREGADO: type: String
  @ApiPropertyOptional({
    type: String,
    example: 'Calle 70 # 45-12, local 3',
    maxLength: 160,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  )
  addressLine?: string | null;

  // AGREGADO: type: String
  @ApiProperty({
    type: String,
    example: '3001234567',
    description: 'Celular colombiano (se normaliza a +57…)',
  })
  @IsString()
  @Matches(WHATSAPP_PATTERN, { message: 'whatsapp debe ser un celular colombiano válido' })
  whatsapp!: string;
}

export class UpdateBusinessDto {
  // AGREGADO: type: String
  @ApiPropertyOptional({ type: String, example: 'Prendería La 70', minLength: 2, maxLength: 80 })
  @ValidateIf((dto: UpdateBusinessDto) => dto.name !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  // AGREGADO: type: String
  @ApiPropertyOptional({ type: String, enum: AMVA_CITIES, example: 'BELLO' })
  @ValidateIf((dto: UpdateBusinessDto) => dto.city !== undefined)
  @IsIn(AMVA_CITIES)
  city?: AmvaCity;

  // AGREGADO: type: String
  @ApiPropertyOptional({
    type: String,
    example: 'Carrera 50 # 20-10',
    maxLength: 160,
    nullable: true,
  })
  @ValidateIf((dto: UpdateBusinessDto) => dto.addressLine !== undefined)
  @IsString()
  @MaxLength(160)
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  })
  addressLine?: string | null;

  // AGREGADO: type: String
  @ApiPropertyOptional({ type: String, example: '3001234567' })
  @ValidateIf((dto: UpdateBusinessDto) => dto.whatsapp !== undefined)
  @IsString()
  @Matches(WHATSAPP_PATTERN, { message: 'whatsapp debe ser un celular colombiano válido' })
  whatsapp?: string;
}

export class UpdateBusinessStatusDto {
  // AGREGADO: type: String
  @ApiProperty({ type: String, enum: BUSINESS_STATUSES, example: 'SUSPENDED' })
  @IsIn(BUSINESS_STATUSES)
  status!: BusinessStatus;
}
