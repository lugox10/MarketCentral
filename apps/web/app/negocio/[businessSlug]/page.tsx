import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ContactBusinessButton } from '@/components/contact-business-form';
import { ListingGrid } from '@/components/marketplace/listing-card';
import { PublicShell } from '@/components/public-shell';
import {
  SITE_URL,
  cityLabel,
  fetchPublicBusiness,
  fetchPublicVerticals,
  whatsappHref,
} from '@/lib/public-catalog';
import { verticalTheme } from '@/lib/vertical-theme';

export const dynamic = 'force-dynamic';

/** Vista previa del catálogo en la portada de la tienda. */
const PREVIEW_SIZE = 8;

interface BusinessPageProps {
  params: Promise<{ businessSlug: string }>;
}

export async function generateMetadata({ params }: BusinessPageProps): Promise<Metadata> {
  const { businessSlug } = await params;
  const business = await fetchPublicBusiness(businessSlug);

  if (!business) {
    return {
      title: 'Negocio no disponible — MarketCentral',
      robots: { index: false, follow: true },
    };
  }

  const description =
    business.description ??
    `Publicaciones activas de ${business.name}, ${business.verticalName.toLowerCase()} en ${cityLabel(business.city)}. Contacto directo con el negocio.`;

  return {
    title: `${business.name} — ${business.verticalName} en ${cityLabel(business.city)} | MarketCentral`,
    description,
    alternates: { canonical: `/negocio/${business.slug}` },
    openGraph: {
      title: `${business.name} — MarketCentral`,
      description,
      url: `${SITE_URL}/negocio/${business.slug}`,
      type: 'website',
      ...(business.coverUrl ? { images: [{ url: business.coverUrl }] } : {}),
    },
  };
}

/** JSON-LD de la tienda: ayuda a Google a entender que es un negocio local. */
function storeJsonLd(business: Awaited<ReturnType<typeof fetchPublicBusiness>>): string | null {
  if (!business) return null;

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    '@id': `${SITE_URL}/negocio/${business.slug}`,
    name: business.name,
    url: `${SITE_URL}/negocio/${business.slug}`,
    ...(business.description ? { description: business.description } : {}),
    ...(business.logoUrl ? { logo: business.logoUrl } : {}),
    ...(business.coverUrl ? { image: business.coverUrl } : {}),
    ...(business.whatsapp ? { telephone: business.whatsapp } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(business.addressLine ? { streetAddress: business.addressLine } : {}),
      addressLocality: cityLabel(business.city),
      addressCountry: 'CO',
    },
    ...(business.categories.length > 0
      ? { department: business.verticalName, makesOffer: business.categories.map((c) => c.name) }
      : { department: business.verticalName }),
  };

  // Evita cerrar el <script> si un texto contiene "</script>".
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export default async function BusinessProfilePage({ params }: BusinessPageProps) {
  const { businessSlug } = await params;

  const [business, verticals] = await Promise.all([
    fetchPublicBusiness(businessSlug, { page: 1, limit: PREVIEW_SIZE }),
    fetchPublicVerticals(),
  ]);

  if (!business) notFound();

  const theme = verticalTheme(business.verticalSlug);
  const initials = business.name.slice(0, 2).toUpperCase();
  const jsonLd = storeJsonLd(business);

  return (
    <PublicShell verticals={verticals ?? []}>
      <main className="mx-auto max-w-6xl px-4 pb-14 pt-6 sm:px-6">
        <nav
          aria-label="Ruta de navegación"
          className="mb-4 flex flex-wrap items-center gap-1 text-xs text-stone-500"
        >
          <Link href="/" className="hover:text-stone-800">
            Inicio
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={`/marketplace/${business.verticalSlug}`} className="hover:text-stone-800">
            {business.verticalName}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-stone-700">{business.name}</span>
        </nav>

        {/* Portada + identidad. La portada es opcional: sin ella se usa el
            degradado del tema de la vertical, nunca una imagen inventada.
            En móvil el logo va debajo de la portada y el nombre nunca se
            superpone: el bloque de identidad es una columna hasta `sm`. */}
        <header className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="relative">
            {business.coverUrl ? (
              // Servida por el API en otro origen: no pasa por el optimizador de Next.
              <img
                src={business.coverUrl}
                alt={`Portada de ${business.name}`}
                className="h-36 w-full object-cover sm:h-52"
              />
            ) : (
              <div
                aria-hidden="true"
                className={`h-36 w-full bg-gradient-to-br sm:h-52 ${theme.coverGradient}`}
              />
            )}
            <span
              className={`absolute left-3 top-3 max-w-[70%] truncate rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide sm:left-4 sm:top-4 ${theme.accentText}`}
            >
              {business.verticalName}
            </span>
          </div>

          <div className="px-4 pb-6 sm:px-8">
            <div className="relative -mt-9 flex flex-col items-start gap-3 sm:-mt-12 sm:flex-row sm:items-end sm:gap-4">
              {business.logoUrl ? (
                // Servida por el API en otro origen: no pasa por el optimizador de Next.
                <img
                  src={business.logoUrl}
                  alt={`Logo de ${business.name}`}
                  className="h-18 w-18 shrink-0 rounded-2xl border-4 border-white bg-white object-cover shadow-sm sm:h-24 sm:w-24"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className={`flex h-18 w-18 shrink-0 items-center justify-center rounded-2xl border-4 border-white text-lg font-semibold text-white shadow-sm sm:h-24 sm:w-24 sm:text-xl ${theme.accentBg}`}
                >
                  {initials}
                </div>
              )}

              <div className="min-w-0 w-full pb-1 sm:flex-1">
                <h1 className="break-words text-xl font-semibold leading-tight text-stone-900 sm:text-2xl">
                  {business.name}
                </h1>
                <p className="mt-0.5 text-sm text-stone-600">
                  {cityLabel(business.city)}
                  {business.addressLine ? ` · ${business.addressLine}` : ''}
                </p>
              </div>
            </div>

            {business.description ? (
              <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-stone-700">
                {business.description}
              </p>
            ) : (
              <p className="mt-4 max-w-3xl text-sm text-stone-500">
                Este negocio todavía no ha escrito su descripción.
              </p>
            )}

            <div className="mt-5 grid gap-2 sm:flex sm:flex-row sm:items-center">
              <a
                href={whatsappHref(business.whatsapp, `las publicaciones de ${business.name}`)}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-lg px-5 py-3 text-center text-sm font-semibold text-white ${theme.accentBg} ${theme.accentHover}`}
              >
                Escribir por WhatsApp
              </a>
              <ContactBusinessButton
                businessSlug={business.slug}
                businessName={business.name}
                variant="outline"
                label="Enviar mensaje"
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-stone-500">
              El formulario deja tus datos al negocio. El contacto y el pago se acuerdan
              directamente con el negocio, fuera de la plataforma.
            </p>
          </div>
        </header>

        <section aria-labelledby="catalogo-tienda" className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 id="catalogo-tienda" className="text-lg font-semibold text-stone-900">
                Catálogo de la tienda
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                {business.listings.total}{' '}
                {business.listings.total === 1 ? 'publicación' : 'publicaciones'} publicadas.
              </p>
            </div>
            {business.listings.total > 0 ? (
              <Link
                href={`/negocio/${business.slug}/catalogo`}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold ${theme.softBg} ${theme.softBorder} ${theme.accentText}`}
              >
                Ver todo el catálogo →
              </Link>
            ) : null}
          </div>

          <div className="mt-5">
            <ListingGrid listings={business.listings.items} />
          </div>

          {business.categories.length > 0 ? (
            <div className="mt-5">
              <p className="text-sm font-medium text-stone-800">Explora por categoría</p>
              <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
                <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
                  {business.categories.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/negocio/${business.slug}/categoria/${item.slug}`}
                        className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                      >
                        {item.name}
                        <span className="text-xs text-stone-500">{item.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </section>

        <section
          className={`mt-10 rounded-2xl border p-6 sm:p-8 ${theme.softBg} ${theme.softBorder}`}
        >
          <h2 className="text-lg font-semibold text-stone-900">
            ¿También vendes artículos usados?
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-stone-700">
            Publica gratis durante dos meses en MarketCentral, sin comisión por venta. Tu tienda
            tendrá el mismo estilo de las demás tiendas de tu sector.
          </p>
          <Link
            href="/register"
            className={`mt-4 inline-block rounded-lg px-5 py-3 text-sm font-semibold text-white ${theme.accentBg} ${theme.accentHover}`}
          >
            Crear mi negocio
          </Link>
        </section>
      </main>

      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      ) : null}
    </PublicShell>
  );
}
