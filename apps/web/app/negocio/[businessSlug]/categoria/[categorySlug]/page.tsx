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

interface CategoryPageProps {
  params: Promise<{ businessSlug: string; categorySlug: string }>;
  searchParams: Promise<{ searchText?: string; page?: string }>;
}

function parsePage(value: string | undefined): number {
  const page = Number(value ?? '1');
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function generateMetadata({
  params,
}: Pick<CategoryPageProps, 'params'>): Promise<Metadata> {
  const { businessSlug, categorySlug } = await params;
  const business = await fetchPublicBusiness(businessSlug, { limit: 1, category: categorySlug });

  if (!business) {
    return { title: 'Negocio no disponible — MarketCentral', robots: { index: false } };
  }

  const category = business.categories.find((item) => item.slug === categorySlug);
  if (!category) {
    return { title: 'Categoría no disponible — MarketCentral', robots: { index: false } };
  }

  return {
    title: `${category.name} de ${business.name} — ${business.verticalName} | MarketCentral`,
    description: `${category.name}: ${category.count} publicaciones de ${business.name} en ${cityLabel(business.city)}.`,
    alternates: { canonical: `/negocio/${business.slug}/categoria/${category.slug}` },
  };
}

export default async function StoreCategoryPage({ params, searchParams }: CategoryPageProps) {
  const { businessSlug, categorySlug } = await params;
  const query = await searchParams;
  const searchText = query.searchText?.trim() || undefined;
  const page = parsePage(query.page);

  const [business, verticals] = await Promise.all([
    fetchPublicBusiness(businessSlug, {
      page,
      limit: PUBLIC_PAGE_SIZE,
      searchText,
      category: categorySlug,
    }),
    fetchPublicVerticals(),
  ]);

  if (!business) notFound();

  const category = business.categories.find((item) => item.slug === categorySlug);
  if (!category) notFound();

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
          <Link href={`/negocio/${business.slug}/catalogo`} className="hover:text-stone-800">
            Catálogo
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-stone-700">{category.name}</span>
        </nav>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold text-stone-900 sm:text-2xl">
              {category.name}
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              {business.name} · {business.verticalName} · {cityLabel(business.city)}
            </p>
          </div>
          <Link
            href={`/negocio/${business.slug}/catalogo`}
            className="self-start rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 sm:self-auto"
          >
            ← Ver todo el catálogo
          </Link>
        </div>

        <StoreCatalog
          business={business}
          theme={theme}
          activeCategorySlug={categorySlug}
          searchText={searchText}
          page={page}
        />
      </main>
    </PublicShell>
  );
}
