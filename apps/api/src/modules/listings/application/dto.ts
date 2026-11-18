import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  LISTING_CONDITIONS,
  LISTING_CURRENCIES,
  LISTING_STATUSES,
  PRICE_MAX,
} from '../domain/listing.js';

export class CreateListingDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ type: String, minLength: 5, maxLength: 120 })
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  title!: string;

  @ApiProperty({ type: String, minLength: 20, maxLength: 4000 })
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  description!: string;

  @ApiProperty({ enum: LISTING_CONDITIONS, type: String })
  @IsIn(LISTING_CONDITIONS)
  condition!: (typeof LISTING_CONDITIONS)[number];

  @ApiProperty({
    type: Number,
    minimum: 0,
    maximum: PRICE_MAX,
    description: 'Importe en la moneda indicada',
  })
  @IsInt()
  @Min(0)
  @Max(PRICE_MAX)
  priceAmount!: number;

  @ApiPropertyOptional({
    enum: LISTING_CURRENCIES,
    type: String,
    default: 'COP',
    description: 'Moneda del precio: pesos colombianos (COP) o dólares (USD)',
  })
  @IsOptional()
  @IsIn(LISTING_CURRENCIES)
  currency?: (typeof LISTING_CURRENCIES)[number];

  @ApiPropertyOptional({
    type: Object,
    description: 'Valores de los atributos de la categoría, indexados por `code`',
    example: { brand: 'Samsung', storage: '128GB' },
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class UpdateListingDto {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ type: String, minLength: 5, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ type: String, minLength: 20, maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ enum: LISTING_CONDITIONS, type: String })
  @IsOptional()
  @IsIn(LISTING_CONDITIONS)
  condition?: (typeof LISTING_CONDITIONS)[number];

  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: PRICE_MAX })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(PRICE_MAX)
  priceAmount?: number;

  @ApiPropertyOptional({ enum: LISTING_CURRENCIES, type: String })
  @IsOptional()
  @IsIn(LISTING_CURRENCIES)
  currency?: (typeof LISTING_CURRENCIES)[number];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class FeatureListingDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  featured!: boolean;
}

export class ReorderImagesDto {
  @ApiProperty({ type: [String], description: 'Ids de las imágenes en el orden deseado' })
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  imageIds!: string[];
}

export class ListListingsQueryDto {
  @ApiPropertyOptional({ enum: LISTING_STATUSES, type: String })
  @IsOptional()
  @IsIn(LISTING_STATUSES)
  status?: (typeof LISTING_STATUSES)[number];

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ type: String, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
