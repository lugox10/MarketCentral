import type { Metadata } from 'next';
import Link from 'next/link';

import { CatalogFilters } from '@/components/marketplace/catalog-filters';
import { ListingGrid } from '@/components/marketplace/listing-card';
import { PublicShell } from '@/components/public-shell';
import {
  PUBLIC_PAGE_SIZE,
  SITE_URL,
  fetchPublicListings,
  fetchPublicVerticals,
  filtersToQuery,
} from '@/lib/public-catalog';

export const dynamic = 'force-dynamic';

interface CatalogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ searchParams }: CatalogPageProps): Promise<Metadata> {
  const params = await searchParams;
  const hasFilters = ['city', 'condition', 'minPrice', 'maxPrice', 'searchText', 'page'].some(
    (key) => single(params[key]) !== undefined,
  );

  return {
    title: 'Catálogo de prenderías — MarketCentral',
    description:
      'Explora artículos de segunda mano de prenderías del Valle de Aburrá: celulares, computadores y más, con precio, condición y contacto directo.',
    alternates: { canonical: '/marketplace' },
    robots: hasFilters ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: 'Catálogo de prenderías — MarketCentral',
      description: 'Artículos de prenderías del Valle de Aburrá.',
      url: `${SITE_URL}/marketplace`,
      type: 'website',
    },
  };
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const page = Number(single(params.page) ?? '1') || 1;

  const [verticals, listings] = await Promise.all([
    fetchPublicVerticals(),
    fetchPublicListings({
      category: single(params.category),
      city: single(params.city),
      condition: single(params.condition),
      minPrice: single(params.minPrice) ? Number(single(params.minPrice)) : undefined,
      maxPrice: single(params.maxPrice) ? Number(single(params.maxPrice)) : undefined,
      searchText: single(params.searchText),
      page,
      limit: PUBLIC_PAGE_SIZE,
    }),
  ]);

  const baseQuery = filtersToQuery({
    category: single(params.category),
    city: single(params.city),
    condition: single(params.condition),
    minPrice: single(params.minPrice) ? Number(single(params.minPrice)) : undefined,
    maxPrice: single(params.maxPrice) ? Number(single(params.maxPrice)) : undefined,
    searchText: single(params.searchText),
  });

  const totalPages = listings?.totalPages ?? 1;

  return (
    <PublicShell verticals={verticals ?? []}>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <nav aria-label="Ruta de navegación" className="mb-3 text-xs text-stone-500">
          <Link href="/" className="hover:text-brand-700">
            Inicio
          </Link>{' '}
          / <span className="text-stone-700">Catálogo</span>
        </nav>

        <h1 className="text-2xl font-semibold text-stone-900 sm:text-3xl">Catálogo</h1>
        <p className="mt-1 text-sm text-stone-600">
          {listings ? `${listings.total} publicaciones activas` : 'Catálogo no disponible'} de
          negocios verificados en el Valle de Aburrá.
        </p>

        <div className="mt-5 space-y-5">
          <CatalogFilters
            action="/marketplace"
            vertical={null}
            values={{
              category: single(params.category),
              city: single(params.city),
              condition: single(params.condition),
              minPrice: single(params.minPrice),
              maxPrice: single(params.maxPrice),
              searchText: single(params.searchText),
            }}
          />

          <ListingGrid listings={listings?.items ?? []} />

          {totalPages > 1 ? (
            <nav aria-label="Paginación" className="flex items-center justify-between gap-3 pt-2">
              {page > 1 ? (
                <Link
                  href={`/marketplace${baseQuery ? `${baseQuery}&` : '?'}page=${page - 1}`}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-white"
                >
                  ← Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-stone-500">
                Página {page} de {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={`/marketplace${baseQuery ? `${baseQuery}&` : '?'}page=${page + 1}`}
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
