import { API_URL } from './api';

/** Sitio público canónico; se usa en metadata, sitemap y JSON-LD. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const PUBLIC_PAGE_SIZE = 12;
export const PUBLIC_PAGE_SIZE_MAX = 24;

export const CITY_LABELS: Record<string, string> = {
  MEDELLIN: 'Medellín',
  BELLO: 'Bello',
  ITAGUI: 'Itagüí',
  ENVIGADO: 'Envigado',
  SABANETA: 'Sabaneta',
  LA_ESTRELLA: 'La Estrella',
  CALDAS: 'Caldas',
  COPACABANA: 'Copacabana',
  GIRARDOTA: 'Girardota',
  BARBOSA: 'Barbosa',
};

export const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo',
  LIKE_NEW: 'Como nuevo',
  GOOD: 'Buen estado',
  FAIR: 'Con uso',
  FOR_PARTS: 'Para repuestos',
};

export interface PublicImage {
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
}

export interface PublicListingCard {
  businessSlug: string;
  businessName: string;
  listingSlug: string;
  title: string;
  priceCop: number;
  currency: string;
  condition: string;
  city: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  featured: boolean;
  publishedAt: string | null;
  image: PublicImage | null;
}

export interface PublicListingsPage {
  items: PublicListingCard[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PublicAttribute {
  code: string;
  name: string;
  type: string;
  value: string;
}

export interface PublicBusinessSummary {
  slug: string;
  name: string;
  city: string;
  addressLine: string;
  whatsapp: string;
  verticalName: string;
  verticalSlug: string;
}

export interface PublicListingDetail extends PublicListingCard {
  id: string;
  description: string;
  attributes: PublicAttribute[];
  images: PublicImage[];
  business: PublicBusinessSummary;
}

export interface PublicVertical {
  id: string;
  name: string;
  slug: string;
  listingCount: number;
}

export interface PublicSitemapEntry {
  businessSlug: string;
  listingSlug: string | null;
  verticalSlug: string;
  updatedAt: string;
}

export interface PublicListingFilters {
  verticalSlug?: string;
  categoryId?: string;
  city?: string;
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  searchText?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
}

/** Formatea el precio en pesos colombianos sin decimales. */
export function formatCop(value: number, currency = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Etiqueta legible de la condición del artículo. */
export function conditionLabel(condition: string): string {
  return CONDITION_LABELS[condition] ?? condition;
}

/** Etiqueta legible de la ciudad del negocio. */
export function cityLabel(city: string): string {
  return CITY_LABELS[city] ?? city;
}

export function listingPath(card: { businessSlug: string; listingSlug: string }): string {
  return `/producto/${card.businessSlug}/${card.listingSlug}`;
}

export function businessPath(businessSlug: string): string {
  return `/negocio/${businessSlug}`;
}

/** Enlace de WhatsApp con mensaje prellenado sobre la publicación. */
export function whatsappHref(whatsapp: string, title: string): string {
  const digits = whatsapp.replace(/[^\d]/g, '');
  const text = encodeURIComponent(`Hola, vi "${title}" en MarketCentral y quiero más información.`);
  return `https://wa.me/${digits}?text=${text}`;
}

/** Query string de filtros, omitiendo valores vacíos. */
export function filtersToQuery(filters: PublicListingFilters): string {
  const params = new URLSearchParams();
  const entries: Array<[string, string | number | boolean | undefined]> = [
    ['verticalSlug', filters.verticalSlug],
    ['categoryId', filters.categoryId],
    ['city', filters.city],
    ['condition', filters.condition],
    ['minPrice', filters.minPrice],
    ['maxPrice', filters.maxPrice],
    ['searchText', filters.searchText],
    ['featured', filters.featured],
    ['page', filters.page],
    ['limit', filters.limit],
  ];
  for (const [key, value] of entries) {
    if (value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

async function publicFetch<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // API caída: las páginas públicas degradan a estado vacío en lugar de romperse.
    return null;
  }
}

export function fetchPublicVerticals(): Promise<PublicVertical[] | null> {
  return publicFetch<PublicVertical[]>('/public/verticals');
}

export function fetchPublicListings(
  filters: PublicListingFilters,
): Promise<PublicListingsPage | null> {
  return publicFetch<PublicListingsPage>(`/public/listings${filtersToQuery(filters)}`);
}

export function fetchPublicListingDetail(
  businessSlug: string,
  listingSlug: string,
): Promise<PublicListingDetail | null> {
  return publicFetch<PublicListingDetail>(
    `/public/listings/${encodeURIComponent(businessSlug)}/${encodeURIComponent(listingSlug)}`,
  );
}

export function fetchPublicBusiness(
  businessSlug: string,
  page = 1,
  limit = PUBLIC_PAGE_SIZE,
): Promise<(PublicBusinessSummary & { listings: PublicListingsPage }) | null> {
  return publicFetch(
    `/public/businesses/${encodeURIComponent(businessSlug)}?page=${page}&limit=${limit}`,
  );
}

export function fetchPublicSitemap(limit = 5000): Promise<PublicSitemapEntry[] | null> {
  return publicFetch<PublicSitemapEntry[]>(`/public/sitemap?limit=${limit}`);
}
