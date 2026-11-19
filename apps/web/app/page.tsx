import type { Metadata } from 'next';
import Link from 'next/link';

import { ListingGrid } from '@/components/marketplace/listing-card';
import { VerticalIcon } from '@/components/marketplace/vertical-icon';
import { PublicShell } from '@/components/public-shell';
import { SITE_URL, fetchPublicListings, fetchPublicVerticals } from '@/lib/public-catalog';

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

export default async function HomePage() {
  const [verticals, featured, latest] = await Promise.all([
    fetchPublicVerticals(),
    fetchPublicListings({ featured: true, limit: 8 }),
    fetchPublicListings({ limit: 8 }),
  ]);

  const activeVerticals = verticals ?? [];
  const featuredItems = featured?.items ?? [];
  const latestItems = latest?.items ?? [];

  return (
    <PublicShell verticals={activeVerticals}>
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-stone-200 bg-gradient-to-b from-brand-50 via-brand-50/60 to-stone-50">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-700/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-900/10 blur-3xl"
          />

          <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">
              El marketplace de los negocios locales
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-stone-900 sm:text-4xl lg:text-5xl">
              Encuentra lo que buscas en los negocios de tu ciudad.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-stone-600">
              Explora productos, compara opciones y contacta directamente a los comercios locales.
            </p>

            <form
              action="/marketplace"
              method="get"
              role="search"
              className="mt-7 flex w-full max-w-2xl flex-col gap-2 sm:flex-row"
            >
              <label htmlFor="home-search" className="sr-only">
                Buscar productos
              </label>
              <input
                id="home-search"
                name="searchText"
                type="search"
                placeholder="¿Qué estás buscando? Ej. iPhone 13, cadena de oro…"
                className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              />
              <button
                type="submit"
                className="rounded-lg bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
              >
                Buscar
              </button>
            </form>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/marketplace"
                className="inline-flex items-center justify-center rounded-lg bg-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
              >
                Explorar catálogo
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-800 transition hover:border-brand-700/40 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
              >
                Publicar mi negocio
              </Link>
            </div>

            <p className="mt-4 text-xs text-stone-500">
              La compra y el pago se acuerdan directamente con cada negocio. MarketCentral no
              procesa pagos de artículos.
            </p>
          </div>
        </section>

        {/* Verticales */}
        {activeVerticals.length > 0 ? (
          <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-stone-900">Explora por categoría</h2>
              <p className="mt-1 text-sm text-stone-500">
                Cada vertical reúne negocios del mismo sector.
              </p>
            </div>

            <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {activeVerticals.map((vertical) => (
                <li key={vertical.id}>
                  <Link
                    href={`/marketplace/${vertical.slug}`}
                    className="group flex h-full flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-700/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white">
                      <VerticalIcon slug={vertical.slug} className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold text-stone-900">{vertical.name}</span>
                    <span className="text-xs leading-relaxed text-stone-500">
                      {vertical.listingCount === 0
                        ? 'Aún sin publicaciones'
                        : `${vertical.listingCount} ${
                            vertical.listingCount === 1 ? 'publicación' : 'publicaciones'
                          }`}
                    </span>
                    <span className="mt-auto text-xs font-medium text-brand-700">
                      Ver catálogo →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Destacados: solo si existen */}
        {featuredItems.length > 0 ? (
          <section className="border-y border-stone-200 bg-white">
            <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-stone-900">Destacados</h2>
                  <p className="mt-1 text-sm text-stone-500">
                    Productos que los negocios quieren mostrar primero.
                  </p>
                </div>
                <Link
                  href="/marketplace"
                  className="text-sm font-medium text-brand-700 hover:underline"
                >
                  Ver todo →
                </Link>
              </div>
              <ListingGrid listings={featuredItems} wide />
            </div>
          </section>
        ) : null}

        {/* Recién publicados */}
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-stone-900">Recién publicados</h2>
              <p className="mt-1 text-sm text-stone-500">
                Descubre lo último que llegó a MarketCentral.
              </p>
            </div>
            <Link
              href="/marketplace"
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Ver todo →
            </Link>
          </div>
          <ListingGrid listings={latestItems} wide />
        </section>

        {/* Bloque para negocios */}
        <section className="border-t border-stone-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <div className="overflow-hidden rounded-2xl bg-brand-900 px-6 py-10 text-white sm:px-10">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-semibold leading-tight">
                  ¿Tienes un negocio? Haz que más personas te encuentren.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-brand-50/90">
                  Publica tu inventario, muestra lo que ofreces y conecta directamente con
                  compradores de tu zona.
                </p>
                <Link
                  href="/register"
                  className="mt-6 inline-flex rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-900 transition hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Publicar mi negocio
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
