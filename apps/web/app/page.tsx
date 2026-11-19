import type { Metadata } from 'next';
import Link from 'next/link';

import { ListingCard } from '@/components/marketplace/listing-card';
import { VerticalIcon } from '@/components/marketplace/vertical-icon';
import { PublicShell } from '@/components/public-shell';
import { SITE_URL, fetchPublicListings, fetchPublicVerticals } from '@/lib/public-catalog';
import type { PublicListingCard, PublicVertical } from '@/lib/public-catalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'MarketCentral — el marketplace de los negocios locales',
  description:
    'Explora productos de negocios locales de Medellín y el Valle de Aburrá, compara opciones y contacta directamente a cada comercio.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'MarketCentral — el marketplace de los negocios locales',
    description:
      'Encuentra lo que buscas en los negocios de tu ciudad. Contacto directo con cada comercio.',
    url: SITE_URL,
    type: 'website',
    locale: 'es_CO',
  },
};

const HOME_LISTING_LIMIT = 8;

type HomePageProps = {
  searchParams: Promise<{
    verticalSlug?: string | string[];
  }>;
};

function verticalLabel(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('es-CO')
    .replace(/(^|\s)\S/gu, (letter) => letter.toLocaleUpperCase('es-CO'));
}

function listingCountLabel(count: number): string {
  if (count === 0) return 'Próximamente';
  return `${count} ${count === 1 ? 'publicación' : 'publicaciones'}`;
}

function HomeListingGrid({ listings }: { listings: PublicListingCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {listings.map((listing, index) => (
        <ListingCard
          key={`${listing.businessSlug}-${listing.listingSlug}`}
          listing={listing}
          priority={index < 4}
        />
      ))}
    </div>
  );
}

function EmptyRecentState({ vertical }: { vertical: PublicVertical | null }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <p className="text-sm font-semibold text-stone-800">
          {vertical
            ? `Todavía no hay publicaciones visibles en ${verticalLabel(vertical.name)}.`
            : 'Todavía no hay publicaciones visibles.'}
        </p>
        <p className="mt-1 text-sm text-stone-500">
          Explora otras categorías para descubrir productos de los negocios locales.
        </p>
      </div>
      <Link
        href="/marketplace"
        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-brand-700/30 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:border-brand-700 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
      >
        Explorar catálogo
      </Link>
    </div>
  );
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const requestedVerticalSlug = Array.isArray(params.verticalSlug)
    ? params.verticalSlug[0]
    : params.verticalSlug;

  const [verticalsResult, featuredResult] = await Promise.all([
    fetchPublicVerticals(),
    fetchPublicListings({ featured: true, limit: HOME_LISTING_LIMIT }),
  ]);

  const activeVerticals = verticalsResult ?? [];
  const selectedVertical =
    activeVerticals.find((vertical) => vertical.slug === requestedVerticalSlug) ?? null;

  // El endpoint prioriza featured=true en su ordenamiento fijo.
  // featured:false mantiene esta sección cronológica y evita repetir la vitrina superior.
  const latestResult = await fetchPublicListings({
    ...(selectedVertical ? { verticalSlug: selectedVertical.slug } : {}),
    featured: false,
    limit: HOME_LISTING_LIMIT,
  });

  const featuredItems = featuredResult?.items ?? [];
  const latestItems = latestResult?.items ?? [];
  const catalogHref = selectedVertical ? `/marketplace/${selectedVertical.slug}` : '/marketplace';

  return (
    <PublicShell verticals={activeVerticals} fillViewport={false}>
      <main>
        {/* Hero compacto: el catálogo debe ocupar más espacio que la descripción. */}
        <section className="border-b border-brand-100 bg-gradient-to-r from-brand-50 via-white to-stone-50">
          <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
            <div className="max-w-4xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-700 sm:text-xs">
                El marketplace de los negocios locales
              </p>
              <h1 className="mt-2 max-w-3xl text-2xl font-semibold leading-tight tracking-tight text-stone-900 sm:text-3xl lg:text-4xl">
                Compra y descubre en los negocios de tu ciudad.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600 sm:text-base">
                Explora productos, compara opciones y contacta directamente a los comercios.
              </p>

              <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
                <form
                  action={
                    selectedVertical ? `/marketplace/${selectedVertical.slug}` : '/marketplace'
                  }
                  method="get"
                  role="search"
                  className="flex w-full max-w-2xl gap-2"
                >
                  <label htmlFor="home-search" className="sr-only">
                    Buscar productos
                  </label>
                  <input
                    id="home-search"
                    name="searchText"
                    type="search"
                    maxLength={100}
                    placeholder="¿Qué estás buscando? Ej. celular, cadena, computador…"
                    className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                  >
                    Buscar
                  </button>
                </form>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={catalogHref}
                    className="inline-flex items-center justify-center rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                  >
                    Explorar catálogo
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:border-brand-700/40 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                  >
                    Publicar mi negocio
                  </Link>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-stone-500">
                La compra y el pago se acuerdan directamente con cada negocio.
              </p>
            </div>
          </div>
        </section>

        {/* Destacados globales: vitrina principal, inmediatamente después del hero. */}
        {featuredItems.length > 0 ? (
          <section className="border-y border-stone-200 bg-white">
            <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-8">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-brand-700" aria-hidden="true" />
                    <h2 className="text-lg font-semibold text-stone-900 sm:text-xl">
                      Productos destacados
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-stone-500">
                    Publicaciones que los negocios quieren mostrar primero.
                  </p>
                </div>
                <Link
                  href="/marketplace"
                  className="text-sm font-semibold text-brand-700 hover:underline"
                >
                  Ver todo →
                </Link>
              </div>
              <HomeListingGrid listings={featuredItems} />
            </div>
          </section>
        ) : null}

        {/* Accesos a verticales: navegación secundaria, sin competir con la vitrina. */}
        {activeVerticals.length > 0 ? (
          <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">Explora por vertical</h2>
                <p className="mt-0.5 text-sm text-stone-500">
                  Encuentra negocios y productos por categoría.
                </p>
              </div>
              <Link
                href="/marketplace"
                className="shrink-0 text-xs font-semibold text-brand-700 hover:underline sm:text-sm"
              >
                Ver catálogo →
              </Link>
            </div>

            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {activeVerticals.map((vertical) => (
                <li key={vertical.id}>
                  <Link
                    href={`/marketplace/${vertical.slug}`}
                    className="group flex h-full items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand-700/40 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 sm:p-4"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white">
                      <VerticalIcon slug={vertical.slug} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-stone-900">
                        {verticalLabel(vertical.name)}
                      </span>
                      <span className="mt-0.5 block text-xs text-stone-500">
                        {listingCountLabel(vertical.listingCount)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Recientes: todos o filtrados por la vertical seleccionada. */}
        <section id="recientes" className="scroll-mt-24 bg-stone-50">
          <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-brand-700" aria-hidden="true" />
                    <h2 className="text-lg font-semibold text-stone-900 sm:text-xl">
                      Recién publicados
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-stone-500">
                    {selectedVertical
                      ? `Lo último de ${verticalLabel(selectedVertical.name)}.`
                      : 'Lo último que llegó a MarketCentral.'}
                  </p>
                </div>
                <Link
                  href={catalogHref}
                  className="text-sm font-semibold text-brand-700 hover:underline"
                >
                  Ver catálogo →
                </Link>
              </div>

              {activeVerticals.length > 0 ? (
                <nav
                  aria-label="Filtrar publicaciones recientes por vertical"
                  className="flex gap-2 overflow-x-auto pb-1"
                >
                  <Link
                    href="/#recientes"
                    aria-current={!selectedVertical ? 'page' : undefined}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 ${
                      !selectedVertical
                        ? 'border-brand-700 bg-brand-700 text-white'
                        : 'border-stone-300 bg-white text-stone-600 hover:border-brand-700/40 hover:text-brand-700'
                    }`}
                  >
                    Todos
                  </Link>
                  {activeVerticals.map((vertical) => {
                    const isSelected = selectedVertical?.slug === vertical.slug;
                    return (
                      <Link
                        key={vertical.id}
                        href={`/?verticalSlug=${encodeURIComponent(vertical.slug)}#recientes`}
                        aria-current={isSelected ? 'page' : undefined}
                        className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 ${
                          isSelected
                            ? 'border-brand-700 bg-brand-700 text-white'
                            : 'border-stone-300 bg-white text-stone-600 hover:border-brand-700/40 hover:text-brand-700'
                        }`}
                      >
                        {verticalLabel(vertical.name)}
                      </Link>
                    );
                  })}
                </nav>
              ) : null}
            </div>

            <div className="mt-5">
              {latestResult === null ? (
                <div
                  role="status"
                  className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-900"
                >
                  No pudimos cargar las publicaciones en este momento. Intenta nuevamente más tarde.
                </div>
              ) : latestItems.length > 0 ? (
                <HomeListingGrid listings={latestItems} />
              ) : (
                <EmptyRecentState vertical={selectedVertical} />
              )}
            </div>
          </div>
        </section>

        {/* Invitación compacta: acompaña al catálogo sin competir con él. */}
        <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-col gap-4 rounded-xl bg-brand-900 px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold">¿Tienes un negocio?</h2>
              <p className="mt-1 text-sm leading-relaxed text-brand-50/90">
                Haz que más personas descubran tus productos y conecta con compradores de tu zona.
              </p>
            </div>
            <Link
              href="/register"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-brand-900 transition hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Publicar mi negocio
            </Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
