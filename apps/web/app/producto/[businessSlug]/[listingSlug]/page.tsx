import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PublicShell } from '@/components/public-shell';
import {
  SITE_URL,
  cityLabel,
  conditionLabel,
  fetchPublicListingDetail,
  fetchPublicVerticals,
  formatCop,
  whatsappHref,
} from '@/lib/public-catalog';

export const dynamic = 'force-dynamic';

interface ListingPageProps {
  params: Promise<{ businessSlug: string; listingSlug: string }>;
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const { businessSlug, listingSlug } = await params;
  const listing = await fetchPublicListingDetail(businessSlug, listingSlug);

  if (!listing) {
    return {
      title: 'Publicación no disponible — MarketCentral',
      robots: { index: false, follow: true },
    };
  }

  const url = `${SITE_URL}/producto/${listing.businessSlug}/${listing.listingSlug}`;
  const description = `${listing.title} en ${listing.businessName}, ${cityLabel(listing.city)}. ${formatCop(listing.priceAmount, listing.currency)} · ${conditionLabel(listing.condition)}. Contacta al negocio por WhatsApp.`;

  return {
    title: `${listing.title} — ${listing.businessName} | MarketCentral`,
    description,
    alternates: { canonical: `/producto/${listing.businessSlug}/${listing.listingSlug}` },
    openGraph: {
      title: `${listing.title} — ${listing.businessName}`,
      description,
      url,
      type: 'website',
      images: listing.images[0]?.url
        ? [{ url: listing.images[0].url, alt: listing.images[0].alt }]
        : undefined,
    },
  };
}

export default async function ListingDetailPage({ params }: ListingPageProps) {
  const { businessSlug, listingSlug } = await params;
  const [listing, verticals] = await Promise.all([
    fetchPublicListingDetail(businessSlug, listingSlug),
    fetchPublicVerticals(),
  ]);

  if (!listing) notFound();

  const url = `${SITE_URL}/producto/${listing.businessSlug}/${listing.listingSlug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: listing.title,
        description: listing.description,
        image: listing.images.filter((image) => image.url).map((image) => image.url),
        itemCondition:
          listing.condition === 'NEW'
            ? 'https://schema.org/NewCondition'
            : 'https://schema.org/UsedCondition',
        offers: {
          '@type': 'Offer',
          price: listing.priceAmount,
          priceCurrency: listing.currency,
          availability: 'https://schema.org/InStock',
          url,
          seller: { '@type': 'Organization', name: listing.businessName },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${SITE_URL}/marketplace` },
          {
            '@type': 'ListItem',
            position: 3,
            name: listing.business.verticalName,
            item: `${SITE_URL}/marketplace/${listing.business.verticalSlug}`,
          },
          { '@type': 'ListItem', position: 4, name: listing.title, item: url },
        ],
      },
    ],
  };

  return (
    <PublicShell verticals={verticals ?? []}>
      <script
        type="application/ld+json"
        // JSON-LD generado en el servidor a partir de datos ya validados.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <nav
          aria-label="Ruta de navegación"
          className="mb-4 flex flex-wrap items-center gap-1 text-xs text-stone-500"
        >
          <Link href="/" className="hover:text-brand-700">
            Inicio
          </Link>
          <span>/</span>
          <Link href="/marketplace" className="hover:text-brand-700">
            Catálogo
          </Link>
          <span>/</span>
          <Link
            href={`/marketplace/${listing.business.verticalSlug}`}
            className="hover:text-brand-700"
          >
            {listing.business.verticalName}
          </Link>
          <span>/</span>
          <span className="truncate text-stone-700">{listing.title}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <section aria-label="Imágenes del artículo" className="space-y-3">
            {listing.images.filter((image) => image.url).length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {listing.images
                  .filter((image) => image.url)
                  .map((image, index) => (
                    // Servidas por el API (disco o S3/R2); el optimizador de Next no aplica.
                    <img
                      key={`${image.url}-${index}`}
                      src={image.url}
                      alt={image.alt}
                      className="aspect-square w-full rounded-xl border border-stone-200 bg-white object-cover"
                    />
                  ))}
              </div>
            ) : (
              <div className="grid aspect-square w-full place-items-center rounded-xl border border-dashed border-stone-300 bg-white text-sm text-stone-500">
                Este artículo no tiene fotos todavía
              </div>
            )}
          </section>

          <section aria-label="Información del artículo" className="space-y-5">
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                {listing.categoryName} · {conditionLabel(listing.condition)}
              </p>
              <h1 className="mt-2 text-2xl font-semibold leading-snug text-stone-900">
                {listing.title}
              </h1>
              <p className="mt-3 text-3xl font-semibold text-stone-900">
                {formatCop(listing.priceAmount, listing.currency)}
              </p>
              {listing.featured ? (
                <span className="mt-3 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                  Destacado
                </span>
              ) : null}

              <div className="mt-5 flex flex-col gap-2">
                <a
                  href={whatsappHref(listing.business.whatsapp, listing.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-brand-700 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                >
                  Escribir por WhatsApp
                </a>
                <Link
                  href={`/negocio/${listing.businessSlug}`}
                  className="rounded-lg border border-stone-300 px-5 py-3 text-center text-sm font-medium text-stone-800 hover:bg-stone-50"
                >
                  Ver otras publicaciones del negocio
                </Link>
              </div>

              <p className="mt-3 text-xs text-stone-500">
                La conversación y el pago se acuerdan directamente con el negocio, fuera de
                MarketCentral.
              </p>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-stone-900">Descripción</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-700">
                {listing.description}
              </p>
            </div>

            {listing.attributes.length > 0 ? (
              <div className="rounded-xl border border-stone-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-stone-900">Detalles</h2>
                <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {listing.attributes.map((attribute) => (
                    <div key={attribute.code} className="rounded-lg bg-stone-50 px-3 py-2">
                      <dt className="text-[11px] uppercase tracking-wide text-stone-500">
                        {attribute.name}
                      </dt>
                      <dd className="text-sm text-stone-800">{attribute.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-stone-900">Sobre el negocio</h2>
              <p className="mt-2 text-sm text-stone-700">
                <Link
                  href={`/negocio/${listing.business.slug}`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {listing.business.name}
                </Link>
              </p>
              <p className="mt-1 text-xs text-stone-500">
                {listing.business.verticalName} · {cityLabel(listing.business.city)} ·{' '}
                {listing.business.addressLine}
              </p>
            </div>
          </section>
        </div>

        <section className="mt-10 rounded-2xl border border-brand-700/20 bg-brand-50/60 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-stone-900">¿Vendes algo similar?</h2>
          <p className="mt-2 max-w-2xl text-sm text-stone-700">
            Crea tu negocio en MarketCentral y publica gratis durante dos meses.
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
