import { Inject, Injectable } from '@nestjs/common';

import { PublicCatalogError } from '../domain/public-catalog-error.js';
import { publicReferenceTime } from '../domain/visibility.js';
import type {
  PublicBusinessSummaryRecord,
  PublicCatalogRepository,
  PublicCategoryLookup,
  PublicCategoryRecord,
  PublicListingCardRecord,
  PublicListingDetailRecord,
  PublicListingsQuery,
  PublicPage,
  PublicVerticalRecord,
  SitemapEntry,
} from './ports.js';
import { PUBLIC_CATALOG_REPOSITORY } from './tokens.js';

function normalizeSearch(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

@Injectable()
export class ListPublicVerticalsUseCase {
  constructor(
    @Inject(PUBLIC_CATALOG_REPOSITORY) private readonly catalog: PublicCatalogRepository,
  ) {}

  execute(): Promise<PublicVerticalRecord[]> {
    return this.catalog.listVerticals(publicReferenceTime());
  }
}

export interface PublicVerticalDetail {
  vertical: PublicVerticalRecord;
  categories: PublicCategoryRecord[];
}

@Injectable()
export class GetPublicVerticalUseCase {
  constructor(
    @Inject(PUBLIC_CATALOG_REPOSITORY) private readonly catalog: PublicCatalogRepository,
  ) {}

  async execute(slug: string): Promise<PublicVerticalDetail> {
    const vertical = await this.catalog.findVerticalBySlug(slug, publicReferenceTime());
    if (!vertical) {
      throw new PublicCatalogError(
        'PUBLIC_VERTICAL_NOT_FOUND',
        'La vertical no existe o está inactiva',
      );
    }
    const categories = await this.catalog.listCategories(vertical.id);
    return { vertical, categories };
  }
}

@Injectable()
export class SearchPublicListingsUseCase {
  constructor(
    @Inject(PUBLIC_CATALOG_REPOSITORY) private readonly catalog: PublicCatalogRepository,
  ) {}

  async execute(input: {
    verticalId?: string;
    verticalSlug?: string;
    city?: string;
    categoryId?: string;
    categorySlug?: string;
    minPrice?: number;
    maxPrice?: number;
    condition?: string;
    searchText?: string;
    featured?: boolean;
    page?: number;
    limit?: number;
  }): Promise<PublicPage<PublicListingCardRecord>> {
    if (
      input.minPrice !== undefined &&
      input.maxPrice !== undefined &&
      input.minPrice > input.maxPrice
    ) {
      throw new PublicCatalogError(
        'INVALID_FILTERS',
        'El precio mínimo no puede ser mayor que el máximo',
      );
    }
    if (input.verticalId && input.verticalSlug) {
      throw new PublicCatalogError(
        'INVALID_FILTERS',
        'Usa verticalId o verticalSlug, no ambos a la vez',
      );
    }

    const now = publicReferenceTime();
    let verticalId = input.verticalId;

    if (input.verticalSlug) {
      const vertical = await this.catalog.findVerticalBySlug(input.verticalSlug, now);
      if (!vertical) {
        throw new PublicCatalogError(
          'PUBLIC_VERTICAL_NOT_FOUND',
          'La vertical no existe o está inactiva',
        );
      }
      verticalId = vertical.id;
    }

    if (input.categoryId && input.categorySlug) {
      throw new PublicCatalogError(
        'INVALID_FILTERS',
        'Usa categoryId o categorySlug, no ambos a la vez',
      );
    }

    let categoryId = input.categoryId;

    if (input.categorySlug || input.categoryId) {
      const category = input.categorySlug
        ? await this.catalog.findCategoryBySlug(input.categorySlug, verticalId)
        : await this.catalog.findCategory(input.categoryId as string);
      if (!category || !category.isActive) {
        throw new PublicCatalogError('INVALID_FILTERS', 'La categoría no está disponible');
      }
      if (verticalId && category.verticalId !== verticalId) {
        throw new PublicCatalogError('INVALID_FILTERS', 'La categoría pertenece a otra vertical');
      }
      verticalId = category.verticalId;
      categoryId = category.id;
    }

    const query: PublicListingsQuery = {
      verticalId,
      city: input.city,
      categoryId,
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
      condition: input.condition,
      searchText: input.searchText ? normalizeSearch(input.searchText) : undefined,
      featured: input.featured,
      page: input.page ?? 1,
      limit: input.limit ?? 12,
    };

    return this.catalog.listListings(query, now);
  }
}

@Injectable()
export class GetPublicListingUseCase {
  constructor(
    @Inject(PUBLIC_CATALOG_REPOSITORY) private readonly catalog: PublicCatalogRepository,
  ) {}

  async execute(businessSlug: string, listingSlug: string): Promise<PublicListingDetailRecord> {
    const detail = await this.catalog.findListingDetail(
      businessSlug,
      listingSlug,
      publicReferenceTime(),
    );
    if (!detail) {
      throw new PublicCatalogError(
        'PUBLIC_LISTING_NOT_FOUND',
        'La publicación no existe o ya no está disponible',
      );
    }
    return detail;
  }
}

@Injectable()
export class GetPublicBusinessUseCase {
  constructor(
    @Inject(PUBLIC_CATALOG_REPOSITORY) private readonly catalog: PublicCatalogRepository,
  ) {}

  async execute(
    businessSlug: string,
    page: number,
    limit: number,
  ): Promise<{
    business: PublicBusinessSummaryRecord;
    listings: PublicPage<PublicListingCardRecord>;
  }> {
    const now = publicReferenceTime();
    const business = await this.catalog.findBusiness(businessSlug, now);
    if (!business) {
      throw new PublicCatalogError(
        'PUBLIC_BUSINESS_NOT_FOUND',
        'El negocio no existe o no está disponible',
      );
    }
    const listings = await this.catalog.listBusinessListings(businessSlug, page, limit, now);
    if (!listings) {
      throw new PublicCatalogError(
        'PUBLIC_BUSINESS_NOT_FOUND',
        'El negocio no existe o no está disponible',
      );
    }
    return { business, listings };
  }
}

@Injectable()
export class GetPublicSitemapUseCase {
  constructor(
    @Inject(PUBLIC_CATALOG_REPOSITORY) private readonly catalog: PublicCatalogRepository,
  ) {}

  execute(limit: number): Promise<SitemapEntry[]> {
    return this.catalog.listSitemap(publicReferenceTime(), limit);
  }
}

export type PublicCategoryLookupView = PublicCategoryLookup;
export type PublicListingDetailView = PublicListingDetailRecord;
export type PublicPageView = PublicPage<PublicListingCardRecord>;
