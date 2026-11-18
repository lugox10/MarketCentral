import type { AttributeDefinitionView, AttributeValue } from '../domain/attributes.js';
import type { ListingCondition, ListingStatus } from '../domain/listing.js';

export interface ListingImageRecord {
  id: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  position: number;
  url: string;
}

export interface ListingRecord {
  id: string;
  businessId: string;
  businessName: string;
  categoryId: string;
  categoryName: string;
  title: string;
  description: string;
  condition: ListingCondition;
  priceAmount: number;
  currency: string;
  status: ListingStatus;
  slug: string;
  attributes: Record<string, AttributeValue>;
  attributesSchemaVersion: number;
  featured: boolean;
  publishedAt: Date | null;
  soldAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  images: ListingImageRecord[];
}

/** Contexto de categoría necesario para validar una publicación. */
export interface CategoryContext {
  id: string;
  verticalId: string;
  businessId: string | null;
  name: string;
  isActive: boolean;
  definitions: AttributeDefinitionView[];
}

export interface ListingLimits {
  maxListings: number;
  featuredSlots: number;
}

export interface ListingFilters {
  status?: ListingStatus;
  categoryId?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface ListingListResult {
  items: ListingRecord[];
  total: number;
}

export interface CreateListingInput {
  businessId: string;
  categoryId: string;
  title: string;
  description: string;
  condition: ListingCondition;
  priceAmount: number;
  currency: string;
  attributes: Record<string, AttributeValue>;
  slug: string;
}

export interface UpdateListingInput {
  title?: string;
  description?: string;
  condition?: ListingCondition;
  priceAmount?: number;
  currency?: string;
  categoryId?: string;
  attributes?: Record<string, AttributeValue>;
  slug?: string;
}

export interface AddImageInput {
  listingId: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  position: number;
}

/** Puerto de salida: persistencia de publicaciones. */
export interface ListingRepository {
  findCategoryContext(categoryId: string): Promise<CategoryContext | null>;
  findById(listingId: string): Promise<ListingRecord | null>;
  listByBusiness(businessId: string, filters: ListingFilters): Promise<ListingListResult>;
  countByBusiness(businessId: string): Promise<number>;
  countFeatured(businessId: string): Promise<number>;
  create(input: CreateListingInput): Promise<ListingRecord>;
  update(listingId: string, input: UpdateListingInput): Promise<ListingRecord>;
  setStatus(
    listingId: string,
    status: ListingStatus,
    timestamps: { publishedAt?: Date; soldAt?: Date; archivedAt?: Date },
  ): Promise<ListingRecord>;
  setFeatured(listingId: string, featured: boolean, at: Date | null): Promise<ListingRecord>;
  slugExists(businessId: string, slug: string): Promise<boolean>;
  listImages(listingId: string): Promise<ListingImageRecord[]>;
  addImage(input: AddImageInput): Promise<ListingImageRecord>;
  removeImage(listingId: string, imageId: string): Promise<void>;
  findImage(listingId: string, imageId: string): Promise<ListingImageRecord | null>;
  reorderImages(listingId: string, orderedIds: string[]): Promise<ListingRecord>;
  /** Imágenes de publicaciones archivadas antes de cutoff, para la purga periódica. */
  listArchivedImagesBefore(cutoff: Date, limit: number): Promise<ArchivedImageRecord[]>;
  /** Borra filas de imagen por id (el objeto se borra antes con MediaStorage). */
  deleteImages(ids: string[]): Promise<void>;
}

export interface ArchivedImageRecord {
  id: string;
  listingId: string;
  storageKey: string;
}

/** Puerto de salida: almacenamiento de objetos (S3/R2 o disco local en desarrollo). */
export interface MediaStorage {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}
