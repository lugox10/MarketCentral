import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MaxLength,
} from 'class-validator';

import { AMVA_CITIES } from '../../businesses/domain/business.js';
import { LISTING_CONDITIONS } from '../../listings/domain/listing.js';

export const PUBLIC_PAGE_SIZE = 12;
export const PUBLIC_PAGE_SIZE_MAX = 24;
export const SEARCH_TEXT_MAX = 100;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Query de `GET /public/listings`. */
export class PublicListingsQueryDto {
  @IsOptional()
  @IsUUID()
  verticalId?: string;

  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'verticalSlug no es válido' })
  @MaxLength(60)
  verticalSlug?: string;

  @IsOptional()
  @IsIn([...AMVA_CITIES], { message: 'La ciudad no está cubierta' })
  city?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'category no es un slug válido' })
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  maxPrice?: number;

  @IsOptional()
  @IsIn(['COP', 'USD'], { message: 'La moneda debe ser COP o USD' })
  currency?: string;

  @IsOptional()
  @IsIn([...LISTING_CONDITIONS])
  condition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(SEARCH_TEXT_MAX)
  searchText?: string;

  @IsOptional()
  @IsBooleanString()
  featured?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PUBLIC_PAGE_SIZE_MAX)
  limit?: number;
}

/** Query de `GET /public/businesses/:businessSlug`. */
export class PublicBusinessQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PUBLIC_PAGE_SIZE_MAX)
  limit?: number;

  /** Búsqueda por título dentro de la tienda. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  searchText?: string;

  /** Slug de una categoría de la vertical para filtrar el catálogo de la tienda. */
  @IsOptional()
  @Matches(SLUG_PATTERN, { message: 'category no es un slug válido' })
  @MaxLength(60)
  category?: string;
}

/** Query del sitemap dinámico (`GET /public/sitemap`). */
export class PublicSitemapQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}
