import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ListingGrid } from '@/components/marketplace/listing-card';
import { PublicShell } from '@/components/public-shell';
import {
  SITE_URL,
  cityLabel,
  fetchPublicBusiness,
  fetchPublicVerticals,
  whatsappHref,
} from '@/lib/public-catalog';

export const dynamic = 'force-dynamic';

interface BusinessPageProps {
  params: Promise<{ businessSlug: string }>;
}

export async function generateMetadata({ params }: BusinessPageProps): Promise<Metadata> {
  const { businessSlug } = await params;
  const business = await fetchPublicBusiness(businessSlug, 1, 12);

  if (!business) {
    return {
      title: 'Negocio no disponible — MarketCentral',
      robots: { index: false, follow: true },
    };
  }

  return {
    title: `${business.name} — ${business.verticalName} en ${cityLabel(business.city)} | MarketCentral`,
    description: `Publicaciones activas de ${business.name}, ${business.verticalName.toLowerCase()} en ${cityLabel(business.city)}. Contacto directo por WhatsApp.`,
    alternates: { canonical: `/negocio/${business.slug}` },
    openGraph: {
      title: `${business.name} — MarketCentral`,
      description: `${business.listings.total} publicaciones activas en ${cityLabel(business.city)}.`,
      url: `${SITE_URL}/negocio/${business.slug}`,
      type: 'website',
    },
  };
}

export default async function BusinessProfilePage({ params }: BusinessPageProps) {
  const { businessSlug } = await params;
  const [business, verticals] = await Promise.all([
    fetchPublicBusiness(businessSlug, 1, 24),
    fetchPublicVerticals(),
  ]);

  if (!business) notFound();

  return (
    <PublicShell verticals={verticals ?? []}>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <nav
          aria-label="Ruta de navegación"
          className="mb-3 flex flex-wrap items-center gap-1 text-xs text-stone-500"
        >
          <Link href="/" className="hover:text-brand-700">
            Inicio
          </Link>
          <span>/</span>
          <Link href={`/marketplace/${business.verticalSlug}`} className="hover:text-brand-700">
            {business.verticalName}
          </Link>
          <span>/</span>
          <span className="text-stone-700">{business.name}</span>
        </nav>

        <header className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-stone-900">{business.name}</h1>
              <p className="mt-1 text-sm text-stone-600">
                {business.verticalName} · {cityLabel(business.city)} · {business.addressLine}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                {business.listings.total}{' '}
                {business.listings.total === 1 ? 'publicación activa' : 'publicaciones activas'}
              </p>
            </div>

            <a
              href={whatsappHref(business.whatsapp, `las publicaciones de ${business.name}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-brand-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-900"
            >
              Escribir por WhatsApp
            </a>
          </div>
          <p className="mt-3 text-xs text-stone-500">
            El contacto y el pago se acuerdan directamente con el negocio, fuera de la plataforma.
          </p>
        </header>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-stone-900">Publicaciones</h2>
          <ListingGrid listings={business.listings.items} />
        </section>

        <section className="mt-10 rounded-2xl border border-brand-700/20 bg-brand-50/60 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-stone-900">
            ¿También vendes artículos usados?
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-stone-700">
            Publica gratis durante dos meses en MarketCentral, sin comisión por venta.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-block rounded-lg bg-brand-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-900"
          >
            Crear mi negocio
          </Link>
        </section>
      </main>
    </PublicShell>
  );
}
