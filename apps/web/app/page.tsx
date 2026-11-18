import type { Metadata } from 'next';
import Link from 'next/link';

import { ListingGrid } from '@/components/marketplace/listing-card';
import { PublicShell } from '@/components/public-shell';
import { SITE_URL, fetchPublicListings, fetchPublicVerticals } from '@/lib/public-catalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'MarketCentral — prenderías de Medellín y el Valle de Aburrá',
  description:
    'Explora celulares, computadores y artículos de segunda mano de prenderías de Medellín y el área metropolitana. Contacta al negocio por WhatsApp.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'MarketCentral — prenderías de Medellín',
    description: 'Catálogo de prenderías del Valle de Aburrá, con contacto directo al negocio.',
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

  const featuredItems = featured?.items ?? [];
  const latestItems = latest?.items ?? [];

  return (
    <PublicShell verticals={verticals ?? []}>
      <main>
        <section className="border-b border-stone-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:py-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                Prenderías · Medellín y área metropolitana
              </p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight text-stone-900 sm:text-4xl">
                Lo que buscas, en la prendería de tu barrio
              </h1>
              <p className="mt-4 max-w-prose text-base leading-relaxed text-stone-600">
                Reunimos el inventario real de prenderías del Valle de Aburrá: celulares,
                computadores y más. Compara precios, revisa la condición de cada artículo y escribe
                al negocio por WhatsApp para acordar la compra.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/marketplace"
                  className="rounded-lg bg-brand-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                >
                  Explorar catálogo
                </Link>
                <Link
                  href="/marketplace/prenderias"
                  className="rounded-lg border border-stone-300 px-5 py-3 text-sm font-medium text-stone-800 transition hover:bg-stone-50"
                >
                  Ver prenderías
                </Link>
              </div>

              <p className="mt-4 text-xs text-stone-500">
                La compra y el pago se acuerdan directamente con cada negocio. MarketCentral no
                procesa pagos de artículos.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 self-center">
              {(verticals ?? []).slice(0, 4).map((vertical) => (
                <Link
                  key={vertical.id}
                  href={`/marketplace/${vertical.slug}`}
                  className="rounded-xl border border-stone-200 bg-stone-50 p-4 transition hover:border-brand-700/40 hover:bg-white"
                >
                  <p className="text-sm font-semibold text-stone-900">{vertical.name}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {vertical.listingCount}{' '}
                    {vertical.listingCount === 1 ? 'publicación' : 'publicaciones'}
                  </p>
                </Link>
              ))}
              {verticals === null ? (
                <p className="col-span-2 text-sm text-stone-500">
                  El catálogo no está disponible en este momento.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-stone-900">Destacados</h2>
              <p className="text-sm text-stone-500">
                Artículos que los negocios quieren mostrar primero.
              </p>
            </div>
            <Link
              href="/marketplace"
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Ver todo →
            </Link>
          </div>
          <ListingGrid listings={featuredItems} />
        </section>

        <section className="border-t border-stone-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-stone-900">Recién publicados</h2>
                <p className="text-sm text-stone-500">Lo último que subieron las prenderías.</p>
              </div>
            </div>
            <ListingGrid listings={latestItems} />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="rounded-2xl border border-brand-700/20 bg-brand-50/60 p-6 sm:p-10">
            <h2 className="text-xl font-semibold text-stone-900">¿Tienes una prendería?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-700">
              Publica gratis durante dos meses, sin comisión por venta. Crea tu negocio, sube tus
              artículos con fotos y recibe contactos directos por WhatsApp.
            </p>
            <Link
              href="/register"
              className="mt-4 inline-block rounded-lg bg-brand-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-900"
            >
              Publica gratis 2 meses
            </Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
