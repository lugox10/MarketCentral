import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CatalogFilters } from '@/components/marketplace/catalog-filters';
import { ListingGrid } from '@/components/marketplace/listing-card';
import { PublicShell } from '@/components/public-shell';
import {
  PUBLIC_PAGE_SIZE,
  SITE_URL,
  fetchPublicListings,
  fetchPublicVerticalDetail,
  fetchPublicVerticals,
  filtersToQuery,
} from '@/lib/public-catalog';

export const dynamic = 'force-dynamic';

interface VerticalPageProps {
  params: Promise<{ verticalSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params }: VerticalPageProps): Promise<Metadata> {
  const { verticalSlug } = await params;
  const verticals = await fetchPublicVerticals();
  const vertical = verticals?.find((item) => item.slug === verticalSlug);

  if (!vertical) {
    return { title: 'Catálogo — MarketCentral', robots: { index: false, follow: true } };
  }

  return {
    title: `${vertical.name} en Medellín y el Valle de Aburrá — MarketCentral`,
    description: `Explora ${vertical.listingCount} publicaciones de ${vertical.name.toLowerCase()} de negocios del Valle de Aburrá, con precio, condición y contacto directo por WhatsApp.`,
    alternates: { canonical: `/marketplace/${vertical.slug}` },
    openGraph: {
      title: `${vertical.name} — MarketCentral`,
      description: `Publicaciones de ${vertical.name.toLowerCase()} del Valle de Aburrá.`,
      url: `${SITE_URL}/marketplace/${vertical.slug}`,
      type: 'website',
    },
  };
}

export default async function VerticalCatalogPage({ params, searchParams }: VerticalPageProps) {
  const [{ verticalSlug }, query] = await Promise.all([params, searchParams]);
  const page = Number(single(query.page) ?? '1') || 1;

  const [verticals, detail, listings] = await Promise.all([
    fetchPublicVerticals(),
    fetchPublicVerticalDetail(verticalSlug),
    fetchPublicListings({
      verticalSlug,
      category: single(query.category),
      city: single(query.city),
      condition: single(query.condition),
      minPrice: single(query.minPrice) ? Number(single(query.minPrice)) : undefined,
      maxPrice: single(query.maxPrice) ? Number(single(query.maxPrice)) : undefined,
      searchText: single(query.searchText),
      page,
      limit: PUBLIC_PAGE_SIZE,
    }),
  ]);

  const vertical = verticals?.find((item) => item.slug === verticalSlug);
  if (!vertical || !detail || !listings) notFound();

  const baseQuery = filtersToQuery({
    category: single(query.category),
    city: single(query.city),
    condition: single(query.condition),
    minPrice: single(query.minPrice) ? Number(single(query.minPrice)) : undefined,
    maxPrice: single(query.maxPrice) ? Number(single(query.maxPrice)) : undefined,
    searchText: single(query.searchText),
  });

  const action = `/marketplace/${vertical.slug}`;

  return (
    <PublicShell verticals={verticals ?? []}>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <nav aria-label="Ruta de navegación" className="mb-3 text-xs text-stone-500">
          <Link href="/" className="hover:text-brand-700">
            Inicio
          </Link>{' '}
          /{' '}
          <Link href="/marketplace" className="hover:text-brand-700">
            Catálogo
          </Link>{' '}
          / <span className="text-stone-700">{vertical.name}</span>
        </nav>

        <h1 className="text-2xl font-semibold text-stone-900 sm:text-3xl">{vertical.name}</h1>
        <p className="mt-1 text-sm text-stone-600">
          {listings.total} {listings.total === 1 ? 'publicación activa' : 'publicaciones activas'}{' '}
          de prenderías del Valle de Aburrá.
        </p>

        <div className="mt-5 space-y-5">
          <CatalogFilters
            action={action}
            vertical={vertical}
            categories={detail.categories.map((category) => ({
              slug: category.slug,
              name: category.name,
            }))}
            values={{
              category: single(query.category),
              city: single(query.city),
              condition: single(query.condition),
              minPrice: single(query.minPrice),
              maxPrice: single(query.maxPrice),
              searchText: single(query.searchText),
            }}
          />

          <ListingGrid listings={listings.items} />

          {listings.totalPages > 1 ? (
            <nav aria-label="Paginación" className="flex items-center justify-between gap-3 pt-2">
              {page > 1 ? (
                <Link
                  href={`${action}${baseQuery ? `${baseQuery}&` : '?'}page=${page - 1}`}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-white"
                >
                  ← Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-stone-500">
                Página {page} de {listings.totalPages}
              </span>
              {page < listings.totalPages ? (
                <Link
                  href={`${action}${baseQuery ? `${baseQuery}&` : '?'}page=${page + 1}`}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-white"
                >
                  Siguiente →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </div>
      </main>
    </PublicShell>
  );
}
