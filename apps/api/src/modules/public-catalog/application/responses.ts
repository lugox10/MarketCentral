import { ApiProperty } from '@nestjs/swagger';

import type {
  PublicBusinessSummaryRecord,
  PublicImageRecord,
  PublicListingCardRecord,
  PublicListingDetailRecord,
  PublicPage,
  PublicVerticalRecord,
  SitemapEntry,
} from './ports.js';

export class PublicVerticalResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  slug!: string;

  @ApiProperty({ type: Number })
  listingCount!: number;
}

export class PublicImageResponseDto {
  @ApiProperty({ type: String })
  url!: string;

  @ApiProperty({ type: Number, nullable: true })
  width!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  height!: number | null;

  @ApiProperty({ type: String })
  alt!: string;
}

export class PublicListingCardResponseDto {
  @ApiProperty({ type: String })
  businessSlug!: string;

  @ApiProperty({ type: String })
  businessName!: string;

  @ApiProperty({ type: String })
  listingSlug!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: Number })
  priceCop!: number;

  @ApiProperty({ type: String })
  currency!: string;

  @ApiProperty({ type: String })
  condition!: string;

  @ApiProperty({ type: String })
  city!: string;

  @ApiProperty({ type: String })
  categoryId!: string;

  @ApiProperty({ type: String })
  categoryName!: string;

  @ApiProperty({ type: String })
  categorySlug!: string;

  @ApiProperty({ type: Boolean })
  featured!: boolean;

  @ApiProperty({ type: String, nullable: true })
  publishedAt!: string | null;

  @ApiProperty({ type: PublicImageResponseDto, nullable: true })
  image!: PublicImageResponseDto | null;
}

export class PublicListingsPageResponseDto {
  @ApiProperty({ type: [PublicListingCardResponseDto] })
  items!: PublicListingCardResponseDto[];

  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  limit!: number;

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: Number })
  totalPages!: number;
}

export class PublicAttributeResponseDto {
  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  type!: string;

  @ApiProperty({ type: String })
  value!: string;
}

export class PublicBusinessSummaryResponseDto {
  @ApiProperty({ type: String })
  slug!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  city!: string;

  @ApiProperty({ type: String })
  addressLine!: string;

  @ApiProperty({ type: String, description: 'Número público en formato E.164 (+57…)' })
  whatsapp!: string;

  @ApiProperty({ type: String })
  verticalName!: string;

  @ApiProperty({ type: String })
  verticalSlug!: string;
}

export class PublicListingDetailResponseDto extends PublicListingCardResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ type: [PublicAttributeResponseDto] })
  attributes!: PublicAttributeResponseDto[];

  @ApiProperty({ type: [PublicImageResponseDto] })
  images!: PublicImageResponseDto[];

  @ApiProperty({ type: PublicBusinessSummaryResponseDto })
  business!: PublicBusinessSummaryResponseDto;
}

export class PublicBusinessResponseDto extends PublicBusinessSummaryResponseDto {
  @ApiProperty({ type: PublicListingsPageResponseDto })
  listings!: PublicListingsPageResponseDto;
}

export class PublicSitemapEntryResponseDto {
  @ApiProperty({ type: String })
  businessSlug!: string;

  @ApiProperty({ type: String, nullable: true })
  listingSlug!: string | null;

  @ApiProperty({ type: String })
  verticalSlug!: string;

  @ApiProperty({ type: String })
  updatedAt!: string;
}

export function toImage(image: PublicImageRecord): PublicImageResponseDto {
  return { url: image.url, width: image.width, height: image.height, alt: image.alt };
}

export function toCard(record: PublicListingCardRecord): PublicListingCardResponseDto {
  return {
    businessSlug: record.businessSlug,
    businessName: record.businessName,
    listingSlug: record.listingSlug,
    title: record.title,
    priceCop: record.priceCop,
    currency: record.currency,
    condition: record.condition,
    city: record.city,
    categoryId: record.categoryId,
    categoryName: record.categoryName,
    categorySlug: record.categorySlug,
    featured: record.featured,
    publishedAt: record.publishedAt ? record.publishedAt.toISOString() : null,
    image: record.image ? toImage(record.image) : null,
  };
}

export function toVertical(record: PublicVerticalRecord): PublicVerticalResponseDto {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    listingCount: record.listingCount,
  };
}

export function toBusinessSummary(
  record: PublicBusinessSummaryRecord,
): PublicBusinessSummaryResponseDto {
  return {
    slug: record.slug,
    name: record.name,
    city: record.city,
    addressLine: record.addressLine,
    whatsapp: record.whatsapp,
    verticalName: record.verticalName,
    verticalSlug: record.verticalSlug,
  };
}

export function toPage(page: PublicPage<PublicListingCardRecord>): PublicListingsPageResponseDto {
  return {
    items: page.items.map(toCard),
    page: page.page,
    limit: page.limit,
    total: page.total,
    totalPages: Math.max(1, Math.ceil(page.total / page.limit)),
  };
}

export function toDetail(record: PublicListingDetailRecord): PublicListingDetailResponseDto {
  return {
    ...toCard(record),
    id: record.id,
    description: record.description,
    attributes: record.attributes.map((attribute) => ({
      code: attribute.code,
      name: attribute.name,
      type: attribute.type,
      value: attribute.value,
    })),
    images: record.images.map(toImage),
    business: toBusinessSummary(record.business),
  };
}

export function toSitemapEntry(entry: SitemapEntry): PublicSitemapEntryResponseDto {
  return {
    businessSlug: entry.businessSlug,
    listingSlug: entry.listingSlug,
    verticalSlug: entry.verticalSlug,
    updatedAt: entry.updatedAt.toISOString(),
  };
}
