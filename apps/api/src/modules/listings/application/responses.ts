import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { AttributeValue } from '../domain/attributes.js';
import type { ListingImageRecord, ListingRecord } from './ports.js';

export class ListingImageResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  url!: string;

  @ApiProperty({ type: String })
  mimeType!: string;

  @ApiProperty({ type: Number })
  sizeBytes!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  width!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  height!: number | null;

  @ApiProperty({ type: Number })
  position!: number;
}

export class ListingLimitsDto {
  @ApiProperty({ type: Number })
  maxListings!: number;

  @ApiProperty({ type: Number })
  used!: number;

  @ApiProperty({ type: Number })
  featuredSlots!: number;

  @ApiProperty({ type: Number })
  featuredUsed!: number;
}

export class ListingResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  slug!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ type: String })
  status!: string;

  @ApiProperty({ type: String })
  condition!: string;

  @ApiProperty({ type: Number })
  priceCop!: number;

  @ApiProperty({ type: String })
  currency!: string;

  @ApiProperty({ type: Boolean })
  featured!: boolean;

  @ApiProperty({ type: String })
  categoryId!: string;

  @ApiProperty({ type: String })
  categoryName!: string;

  @ApiProperty({ type: Object, description: 'Atributos validados de la categoría' })
  attributes!: Record<string, AttributeValue>;

  @ApiProperty({ type: Number })
  attributesSchemaVersion!: number;

  @ApiProperty({ type: [ListingImageResponseDto] })
  images!: ListingImageResponseDto[];

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  publishedAt!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  soldAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class ListingDetailResponseDto {
  @ApiProperty({ type: ListingResponseDto })
  listing!: ListingResponseDto;

  @ApiProperty({ type: ListingLimitsDto })
  limits!: ListingLimitsDto;
}

export class ListingListResponseDto {
  @ApiProperty({ type: [ListingResponseDto] })
  items!: ListingResponseDto[];

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  limit!: number;

  @ApiProperty({ type: Number })
  totalPages!: number;

  @ApiProperty({ type: ListingLimitsDto })
  limits!: ListingLimitsDto;
}

export function toListingImage(image: ListingImageRecord): ListingImageResponseDto {
  return {
    id: image.id,
    url: image.url,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    width: image.width,
    height: image.height,
    position: image.position,
  };
}

export function toListingResponse(
  listing: ListingRecord,
  publicUrl: (key: string) => string,
): ListingResponseDto {
  return {
    id: listing.id,
    title: listing.title,
    slug: listing.slug,
    description: listing.description,
    status: listing.status,
    condition: listing.condition,
    priceCop: listing.priceCop,
    currency: listing.currency,
    featured: listing.featured,
    categoryId: listing.categoryId,
    categoryName: listing.categoryName,
    attributes: listing.attributes,
    attributesSchemaVersion: listing.attributesSchemaVersion,
    images: listing.images.map((image) =>
      toListingImage({ ...image, url: publicUrl(image.storageKey) }),
    ),
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    soldAt: listing.soldAt?.toISOString() ?? null,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}
