import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service.js';
import { MEDIA_STORAGE } from '../../listings/application/tokens.js';
import type { MediaStorage } from '../../listings/application/ports.js';
import { PUBLIC_SUBSCRIPTION_STATUSES } from '../domain/visibility.js';
import type {
  PublicBusinessSummaryRecord,
  PublicCatalogRepository,
  PublicCategoryLookup,
  PublicCategoryRecord,
  PublicImageRecord,
  PublicListingCardRecord,
  PublicListingDetailRecord,
  PublicListingsQuery,
  PublicPage,
  PublicVerticalRecord,
  SitemapEntry,
} from '../application/ports.js';

/**
 * Filtro de visibilidad pública replicado en SQL.
 *
 * Debe coincidir con `isPubliclyVisible` (dominio). Si cambia una regla, cambian
 * las dos: la prueba `public-catalog.spec.ts` cubre cada condición.
 */
function visibleListingWhere(now: Date): Prisma.ListingWhereInput {
  return {
    status: 'PUBLISHED',
    business: {
      status: 'APPROVED',
      subscription: {
        is: {
          status: { in: [...PUBLIC_SUBSCRIPTION_STATUSES] },
          currentPeriodEnd: { gt: now },
        },
      },
    },
  };
}

function visibleBusinessWhere(now: Date): Prisma.BusinessWhereInput {
  return {
    status: 'APPROVED',
    subscription: {
      is: {
        status: { in: [...PUBLIC_SUBSCRIPTION_STATUSES] },
        currentPeriodEnd: { gt: now },
      },
    },
  };
}

interface ListingRow {
  slug: string;
  title: string;
  priceCop: number;
  currency: string;
  condition: string;
  featured: boolean;
  publishedAt: Date | null;
  category: { id: string; name: string; slug: string; verticalId: string };
  business: { slug: string; name: string; city: string };
  images: Array<{ storageKey: string; width: number | null; height: number | null }>;
}

@Injectable()
export class PrismaPublicCatalogRepository implements PublicCatalogRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  private image(row: ListingRow): PublicImageRecord | null {
    const first = row.images[0];
    if (!first) return null;
    return {
      url: this.storage.publicUrl(first.storageKey),
      width: first.width,
      height: first.height,
      alt: `${row.title} — ${row.business.name}`,
    };
  }

  private toCard(row: ListingRow): PublicListingCardRecord {
    return {
      businessSlug: row.business.slug,
      businessName: row.business.name,
      listingSlug: row.slug,
      title: row.title,
      priceCop: row.priceCop,
      currency: row.currency,
      condition: row.condition,
      city: row.business.city,
      categoryId: row.category.id,
      categoryName: row.category.name,
      categorySlug: row.category.slug,
      featured: row.featured,
      publishedAt: row.publishedAt,
      image: this.image(row),
    };
  }

  async listVerticals(now: Date): Promise<PublicVerticalRecord[]> {
    const verticals = await this.prisma.vertical.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    });

    return Promise.all(
      verticals.map(async (vertical) => ({
        ...vertical,
        listingCount: await this.prisma.listing.count({
          where: {
            ...visibleListingWhere(now),
            category: { verticalId: vertical.id, isActive: true },
          },
        }),
      })),
    );
  }

  async findVerticalBySlug(slug: string, now: Date): Promise<PublicVerticalRecord | null> {
    const vertical = await this.prisma.vertical.findFirst({
      where: { slug, isActive: true },
      select: { id: true, name: true, slug: true },
    });
    if (!vertical) return null;
    const listingCount = await this.prisma.listing.count({
      where: {
        ...visibleListingWhere(now),
        category: { verticalId: vertical.id, isActive: true },
      },
    });
    return { ...vertical, listingCount };
  }

  async listCategories(verticalId: string): Promise<PublicCategoryRecord[]> {
    const categories = await this.prisma.category.findMany({
      where: { verticalId, businessId: null, isActive: true },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, parentId: true },
    });
    return categories;
  }

  async findCategory(categoryId: string): Promise<PublicCategoryLookup | null> {
    return this.prisma.category.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        verticalId: true,
        isActive: true,
      },
    });
  }

  async listListings(
    query: PublicListingsQuery,
    now: Date,
  ): Promise<PublicPage<PublicListingCardRecord>> {
    const where: Prisma.ListingWhereInput = {
      ...visibleListingWhere(now),
      ...(query.verticalId ? { category: { verticalId: query.verticalId, isActive: true } } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.city ? { business: { status: 'APPROVED', city: query.city as never } } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            priceCop: {
              ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
              ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
            },
          }
        : {}),
      ...(query.condition ? { condition: query.condition as never } : {}),
      ...(query.featured ? { featured: true } : {}),
      ...(query.searchText
        ? {
            OR: [
              { title: { contains: query.searchText, mode: 'insensitive' } },
              { description: { contains: query.searchText, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // El filtro por ciudad se combina con la condición de negocio visible.
    if (query.city) {
      where.business = { ...visibleBusinessWhere(now), city: query.city as never };
    }

    const select = {
      slug: true,
      title: true,
      priceCop: true,
      currency: true,
      condition: true,
      featured: true,
      publishedAt: true,
      category: { select: { id: true, name: true, slug: true, verticalId: true } },
      business: { select: { slug: true, name: true, city: true } },
      images: {
        orderBy: { position: 'asc' },
        take: 1,
        select: { storageKey: true, width: true, height: true },
      },
    } satisfies Prisma.ListingSelect;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select,
      }),
    ]);

    return {
      items: rows.map((row) => this.toCard(row)),
      page: query.page,
      limit: query.limit,
      total,
    };
  }

  async findListingDetail(
    businessSlug: string,
    listingSlug: string,
    now: Date,
  ): Promise<PublicListingDetailRecord | null> {
    const row = await this.prisma.listing.findFirst({
      where: {
        ...visibleListingWhere(now),
        slug: listingSlug,
        business: { ...visibleBusinessWhere(now), slug: businessSlug },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        priceCop: true,
        currency: true,
        condition: true,
        featured: true,
        publishedAt: true,
        attributes: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            verticalId: true,
            attributes: {
              orderBy: { name: 'asc' },
              select: { code: true, name: true, type: true },
            },
          },
        },
        business: {
          select: {
            slug: true,
            name: true,
            city: true,
            addressLine: true,
            whatsapp: true,
            vertical: { select: { name: true, slug: true } },
          },
        },
        images: {
          orderBy: { position: 'asc' },
          select: { storageKey: true, width: true, height: true },
        },
      },
    });

    if (!row) return null;

    const values = (row.attributes ?? {}) as Record<string, unknown>;
    const attributes = row.category.attributes
      .filter((definition) => values[definition.code] !== undefined)
      .map((definition) => {
        const raw = values[definition.code];
        const text =
          typeof raw === 'boolean'
            ? raw
              ? 'Sí'
              : 'No'
            : Array.isArray(raw)
              ? raw.join(', ')
              : String(raw);
        return { code: definition.code, name: definition.name, type: definition.type, value: text };
      });

    const images = row.images.map((image, index) => ({
      url: this.storage.publicUrl(image.storageKey),
      width: image.width,
      height: image.height,
      alt: `${row.title} — imagen ${index + 1} de ${row.business.name}`,
    }));

    if (images.length === 0) {
      images.push({
        url: '',
        width: null,
        height: null,
        alt: `${row.title} — sin imagen disponible`,
      });
    }

    return {
      ...this.toCard({ ...row, images: row.images.slice(0, 1) }),
      id: row.id,
      description: row.description,
      attributes,
      images,
      business: {
        slug: row.business.slug,
        name: row.business.name,
        city: row.business.city,
        addressLine: row.business.addressLine,
        whatsapp: row.business.whatsapp,
        verticalName: row.business.vertical.name,
        verticalSlug: row.business.vertical.slug,
      },
    };
  }

  async findBusiness(slug: string, now: Date): Promise<PublicBusinessSummaryRecord | null> {
    const business = await this.prisma.business.findFirst({
      where: { ...visibleBusinessWhere(now), slug },
      select: {
        slug: true,
        name: true,
        city: true,
        addressLine: true,
        whatsapp: true,
        vertical: { select: { name: true, slug: true } },
      },
    });
    if (!business) return null;
    return {
      slug: business.slug,
      name: business.name,
      city: business.city,
      addressLine: business.addressLine,
      whatsapp: business.whatsapp,
      verticalName: business.vertical.name,
      verticalSlug: business.vertical.slug,
    };
  }

  async listBusinessListings(
    businessSlug: string,
    page: number,
    limit: number,
    now: Date,
  ): Promise<PublicPage<PublicListingCardRecord> | null> {
    const business = await this.prisma.business.findFirst({
      where: { ...visibleBusinessWhere(now), slug: businessSlug },
      select: { id: true },
    });
    if (!business) return null;

    const where: Prisma.ListingWhereInput = {
      ...visibleListingWhere(now),
      businessId: business.id,
    };

    const select = {
      slug: true,
      title: true,
      priceCop: true,
      currency: true,
      condition: true,
      featured: true,
      publishedAt: true,
      category: { select: { id: true, name: true, slug: true, verticalId: true } },
      business: { select: { slug: true, name: true, city: true } },
      images: {
        orderBy: { position: 'asc' },
        take: 1,
        select: { storageKey: true, width: true, height: true },
      },
    } satisfies Prisma.ListingSelect;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select,
      }),
    ]);

    return { items: rows.map((row) => this.toCard(row)), page, limit, total };
  }

  async listSitemap(now: Date, limit: number): Promise<SitemapEntry[]> {
    const rows = await this.prisma.listing.findMany({
      where: visibleListingWhere(now),
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        slug: true,
        updatedAt: true,
        business: { select: { slug: true, vertical: { select: { slug: true } } } },
      },
    });

    const entries: SitemapEntry[] = rows.map((row) => ({
      businessSlug: row.business.slug,
      listingSlug: row.slug,
      verticalSlug: row.business.vertical.slug,
      updatedAt: row.updatedAt,
    }));

    const seen = new Set<string>();
    for (const entry of [...entries]) {
      if (seen.has(entry.businessSlug)) continue;
      seen.add(entry.businessSlug);
      entries.push({
        businessSlug: entry.businessSlug,
        listingSlug: null,
        verticalSlug: entry.verticalSlug,
        updatedAt: entry.updatedAt,
      });
    }

    return entries;
  }
}
