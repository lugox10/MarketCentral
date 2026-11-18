import { Inject, Injectable } from '@nestjs/common';

import { ListingError } from '../domain/listing-error.js';
import type { ListingStatus } from '../domain/listing.js';
import { LISTING_REPOSITORY } from './tokens.js';
import type { ListingRecord, ListingRepository } from './ports.js';
import { ListingsSupport } from './use-cases.js';

export interface ListingListPage {
  items: ListingRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  limits: { maxListings: number; used: number; featuredSlots: number; featuredUsed: number };
}

@Injectable()
export class ListMyListingsUseCase {
  constructor(
    @Inject(LISTING_REPOSITORY) private readonly listings: ListingRepository,
    @Inject(ListingsSupport) private readonly support: ListingsSupport,
  ) {}

  async execute(input: {
    userId: string;
    status?: ListingStatus;
    categoryId?: string;
    search?: string;
    page: number;
    limit: number;
  }): Promise<ListingListPage> {
    const context = await this.support.requireBusiness(input.userId);
    const businessId = context.business.id;

    const [result, used, featuredUsed] = await Promise.all([
      this.listings.listByBusiness(businessId, {
        status: input.status,
        categoryId: input.categoryId,
        search: input.search,
        page: input.page,
        limit: input.limit,
      }),
      this.listings.countByBusiness(businessId),
      this.listings.countFeatured(businessId),
    ]);

    return {
      items: result.items,
      total: result.total,
      page: input.page,
      limit: input.limit,
      totalPages: Math.max(1, Math.ceil(result.total / input.limit)),
      limits: {
        maxListings: context.subscription?.plan.maxListings ?? 0,
        used,
        featuredSlots: context.subscription?.plan.featuredSlots ?? 0,
        featuredUsed,
      },
    };
  }
}

@Injectable()
export class GetMyListingUseCase {
  constructor(
    @Inject(LISTING_REPOSITORY) private readonly listings: ListingRepository,
    @Inject(ListingsSupport) private readonly support: ListingsSupport,
  ) {}

  async execute(input: { userId: string; listingId: string }): Promise<ListingRecord> {
    const context = await this.support.requireBusiness(input.userId);
    const listing = await this.listings.findById(input.listingId);
    if (!listing) throw new ListingError('LISTING_NOT_FOUND', 'La publicación no existe');
    if (listing.businessId !== context.business.id) {
      throw new ListingError('LISTING_NOT_OWNED', 'La publicación pertenece a otro negocio');
    }
    return listing;
  }
}
