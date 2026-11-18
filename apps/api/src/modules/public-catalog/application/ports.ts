export interface PublicVerticalRecord {
  id: string;
  name: string;
  slug: string;
  listingCount: number;
}

export interface PublicImageRecord {
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
}

export interface PublicListingCardRecord {
  businessSlug: string;
  businessName: string;
  listingSlug: string;
  title: string;
  priceAmount: number;
  currency: string;
  condition: string;
  city: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  featured: boolean;
  publishedAt: Date | null;
  image: PublicImageRecord | null;
}

export interface PublicAttributeRecord {
  code: string;
  name: string;
  type: string;
  value: string;
}

export interface PublicBusinessSummaryRecord {
  slug: string;
  name: string;
  city: string;
  addressLine: string;
  whatsapp: string;
  verticalName: string;
  verticalSlug: string;
}

export interface PublicListingDetailRecord extends PublicListingCardRecord {
  id: string;
  description: string;
  attributes: PublicAttributeRecord[];
  images: PublicImageRecord[];
  business: PublicBusinessSummaryRecord;
}

export interface PublicListingsQuery {
  verticalId?: string;
  city?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  condition?: string;
  searchText?: string;
  featured?: boolean;
  page: number;
  limit: number;
}

export interface PublicPage<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface PublicCategoryRecord {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

export interface PublicCategoryLookup extends PublicCategoryRecord {
  verticalId: string;
  isActive: boolean;
}

export interface SitemapEntry {
  businessSlug: string;
  listingSlug: string | null;
  verticalSlug: string;
  updatedAt: Date;
}

export interface PublicCatalogRepository {
  listVerticals(now: Date): Promise<PublicVerticalRecord[]>;
  findVerticalBySlug(slug: string, now: Date): Promise<PublicVerticalRecord | null>;
  listCategories(verticalId: string): Promise<PublicCategoryRecord[]>;
  findCategory(categoryId: string): Promise<PublicCategoryLookup | null>;
  findCategoryBySlug(slug: string, verticalId?: string): Promise<PublicCategoryLookup | null>;
  listListings(query: PublicListingsQuery, now: Date): Promise<PublicPage<PublicListingCardRecord>>;
  findListingDetail(
    businessSlug: string,
    listingSlug: string,
    now: Date,
  ): Promise<PublicListingDetailRecord | null>;
  findBusiness(slug: string, now: Date): Promise<PublicBusinessSummaryRecord | null>;
  listBusinessListings(
    businessSlug: string,
    page: number,
    limit: number,
    now: Date,
  ): Promise<PublicPage<PublicListingCardRecord> | null>;
  listSitemap(now: Date, limit: number): Promise<SitemapEntry[]>;
}
