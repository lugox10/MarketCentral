import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PublicShell } from '@/components/public-shell';
import { StoreCatalog } from '@/components/store/store-catalog';
import {
  PUBLIC_PAGE_SIZE,
  cityLabel,
  fetchPublicBusiness,
  fetchPublicVerticals,
} from '@/lib/public-catalog';
import { verticalTheme } from '@/lib/vertical-theme';

export const dynamic = 'force-dynamic';

interface CatalogPageProps {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ searchText?: string; category?: string; page?: string }>;
}

function parsePage(value: string | undefined): number {
  const page = Number(value ?? '1');
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function generateMetadata({ params }: CatalogPageProps): Promise<Metadata> {
  const { businessSlug } = await params;
  const business = await fetchPublicBusiness(businessSlug);

  if (!business) {
    return { title: 'Negocio no disponible — MarketCentral', robots: { index: false } };
  }

  return {
    title: `Catálogo de ${business.name} — ${business.verticalName} | MarketCentral`,
    description: `Todas las publicaciones de ${business.name} en ${cityLabel(business.city)}.`,
    alternates: { canonical: `/negocio/${business.slug}/catalogo` },
  };
}

export default async function StoreCatalogPage({ params, searchParams }: CatalogPageProps) {
  const { businessSlug } = await params;
  const query = await searchParams;
  const searchText = query.searchText?.trim() || undefined;
  const category = query.category || undefined;
  const page = parsePage(query.page);

  const [business, verticals] = await Promise.all([
    fetchPublicBusiness(businessSlug, { page, limit: PUBLIC_PAGE_SIZE, searchText, category }),
    fetchPublicVerticals(),
  ]);

  if (!business) notFound();

  const theme = verticalTheme(business.verticalSlug);

  return (
    <PublicShell verticals={verticals ?? []}>
      <main className="mx-auto max-w-6xl px-4 pb-14 pt-5 sm:px-6">
        <nav
          aria-label="Ruta de navegación"
          className="mb-4 flex flex-wrap items-center gap-1 text-xs text-stone-500"
        >
          <Link href="/" className="hover:text-stone-800">
            Inicio
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={`/negocio/${business.slug}`} className="hover:text-stone-800">
            {business.name}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-stone-700">Catálogo</span>
        </nav>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold text-stone-900 sm:text-2xl">
              Catálogo de {business.name}
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              {business.verticalName} · {cityLabel(business.city)}
            </p>
          </div>
          <Link
            href={`/negocio/${business.slug}`}
            className="self-start rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 sm:self-auto"
          >
            ← Volver a la tienda
          </Link>
        </div>

        <StoreCatalog
          business={business}
          theme={theme}
          activeCategorySlug={category}
          searchText={searchText}
          page={page}
        />
      </main>
    </PublicShell>
  );
}
