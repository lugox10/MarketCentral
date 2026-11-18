import { deleteJson, getJson, patchJson, postForm, postJson } from './api';
import type { BadgeTone } from '../components/taxonomy-ui';

export type ListingStatus = 'DRAFT' | 'PUBLISHED' | 'SOLD' | 'ARCHIVED';
export type ListingCondition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'FOR_PARTS';
export type AttributeType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'ENUM';
export type ListingAttributeValue = string | number | boolean;

export interface ListingImage {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  position: number;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  condition: ListingCondition;
  priceCop: number;
  currency: string;
  status: ListingStatus;
  slug: string;
  featured: boolean;
  featuredAt: string | null;
  publishedAt: string | null;
  soldAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  categoryId: string;
  categoryName: string;
  businessName: string;
  attributes: Record<string, ListingAttributeValue>;
  attributesSchemaVersion: number;
  images: ListingImage[];
}

export interface ListingLimits {
  maxListings: number;
  used: number;
  featuredSlots: number;
  featuredUsed: number;
}

export interface ListingList {
  items: Listing[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  limits: ListingLimits;
}

export interface AttributeOption {
  id: string;
  value: string;
}

export interface AttributeDefinition {
  id: string;
  code: string;
  name: string;
  type: AttributeType;
  isRequired: boolean;
  isFilterable: boolean;
  options?: AttributeOption[];
}

export interface UsableCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  isOwn: boolean;
}

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicado',
  SOLD: 'Vendido',
  ARCHIVED: 'Archivado',
};

export const LISTING_CONDITION_LABELS: Record<ListingCondition, string> = {
  NEW: 'Nuevo',
  LIKE_NEW: 'Como nuevo',
  GOOD: 'Buen estado',
  FAIR: 'Aceptable',
  FOR_PARTS: 'Para repuestos',
};

export const STATUS_TONES: Record<ListingStatus, BadgeTone> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  SOLD: 'brand',
  ARCHIVED: 'outline',
};

export const CONDITIONS = Object.keys(LISTING_CONDITION_LABELS) as ListingCondition[];

/** Formatea pesos colombianos sin decimales. */
export function formatPrice(value: number, currency = 'COP'): string {
  const amount = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
  return amount;
}

/** Explica en una frase el siguiente paso natural de la publicación. */
export function listingStateHint(status: ListingStatus, featured: boolean): string {
  if (status === 'DRAFT') return 'Borrador: solo tú lo ves. Añade una imagen y publícalo.';
  if (status === 'PUBLISHED') {
    return featured
      ? 'Publicado y destacado en el catálogo.'
      : 'Publicado. Puedes destacarlo si tienes cupo.';
  }
  if (status === 'SOLD') return 'Vendido: se conserva como historial y no cuenta para el cupo.';
  return 'Archivado: no se puede reactivar.';
}

/** Pares legibles de los atributos configurados, omitiendo los vacíos. */
export function attributesSummary(
  definitions: AttributeDefinition[],
  values: Record<string, ListingAttributeValue>,
): Array<{ label: string; value: string }> {
  return definitions
    .map((definition) => {
      const raw = values[definition.code];
      if (raw === undefined || raw === null || raw === '') return null;
      const value = typeof raw === 'boolean' ? (raw ? 'Sí' : 'No') : String(raw);
      return { label: definition.name, value };
    })
    .filter((item): item is { label: string; value: string } => item !== null);
}

/** Una publicación necesita al menos una imagen para publicarse. */
export function isPublishable(listing: Pick<Listing, 'images'>): boolean {
  return listing.images.length > 0;
}

export function listingSlugLabel(listing: Pick<Listing, 'slug'>): string {
  return `/${listing.slug}`;
}

export interface ListingQuery {
  status?: ListingStatus | '';
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function fetchMyListings(query: ListingQuery = {}): Promise<ListingList> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.categoryId) params.set('categoryId', query.categoryId);
  if (query.search) params.set('search', query.search);
  params.set('page', String(query.page ?? 1));
  params.set('limit', String(query.limit ?? 10));
  return getJson<ListingList>(`/businesses/me/listings?${params.toString()}`);
}

export function fetchMyListing(listingId: string): Promise<Listing> {
  return getJson<Listing>(`/businesses/me/listings/${listingId}`);
}

export interface ListingWriteBody {
  categoryId: string;
  title: string;
  description: string;
  condition: ListingCondition;
  priceCop: number;
  attributes?: Record<string, ListingAttributeValue>;
}

export function createListing(body: ListingWriteBody): Promise<Listing> {
  return postJson<Listing>('/businesses/me/listings', body);
}

export function updateListing(
  listingId: string,
  body: Partial<ListingWriteBody>,
): Promise<Listing> {
  return patchJson<Listing>(`/businesses/me/listings/${listingId}`, body);
}

export function publishListing(listingId: string): Promise<Listing> {
  return postJson<Listing>(`/businesses/me/listings/${listingId}/publish`, {});
}

export function sellListing(listingId: string): Promise<Listing> {
  return postJson<Listing>(`/businesses/me/listings/${listingId}/sell`, {});
}

export function archiveListing(listingId: string): Promise<Listing> {
  return postJson<Listing>(`/businesses/me/listings/${listingId}/archive`, {});
}

export function setListingFeatured(listingId: string, featured: boolean): Promise<Listing> {
  return patchJson<Listing>(`/businesses/me/listings/${listingId}/feature`, { featured });
}

export function uploadListingImage(listingId: string, file: File): Promise<ListingImage> {
  const form = new FormData();
  form.append('file', file, file.name);
  return postForm<ListingImage>(`/businesses/me/listings/${listingId}/images`, form);
}

export function removeListingImage(listingId: string, imageId: string): Promise<void> {
  return deleteJson<void>(`/businesses/me/listings/${listingId}/images/${imageId}`);
}

export function reorderListingImages(
  listingId: string,
  imageIds: string[],
): Promise<ListingImage[]> {
  return patchJson<ListingImage[]>(`/businesses/me/listings/${listingId}/images/order`, {
    imageIds,
  });
}

/** Atributos configurados de una categoría global del catálogo. */
export async function fetchCategoryAttributes(categoryId: string): Promise<AttributeDefinition[]> {
  const response = await getJson<{ categoryId: string; items: AttributeDefinition[] }>(
    `/taxonomy/categories/${categoryId}/attributes`,
  );
  return response.items;
}

/** Categorías globales (catálogo) de una vertical. */
export async function fetchGlobalCategories(verticalId: string): Promise<UsableCategory[]> {
  const response = await getJson<{
    verticalId: string;
    items: Array<{ id: string; name: string; slug: string; parentId: string | null }>;
  }>(`/taxonomy/verticals/${verticalId}/categories`);
  return response.items.map((item) => ({ ...item, isOwn: false }));
}

/** Categorías propias del negocio (cupo del plan). */
export async function fetchOwnCategories(): Promise<UsableCategory[]> {
  const response = await getJson<{
    items: Array<{ id: string; name: string; slug: string; parentId: string | null }>;
  }>('/businesses/me/categories');
  return response.items.map((item) => ({ ...item, isOwn: true }));
}
