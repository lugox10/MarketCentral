import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ContactBusinessButton } from '@/components/contact-business-form';
import { ListingGrid } from '@/components/marketplace/listing-card';
import { PublicShell } from '@/components/public-shell';
import {
  PUBLIC_PAGE_SIZE,
  SITE_URL,
  cityLabel,
  fetchPublicBusiness,
  fetchPublicVerticals,
  whatsappHref,
} from '@/lib/public-catalog';
import { verticalTheme } from '@/lib/vertical-theme';

export const dynamic = 'force-dynamic';

interface BusinessPageProps {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ searchText?: string; category?: string; page?: string }>;
}

function parsePage(value: string | undefined): number {
  const page = Number(value ?? '1');
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function storeHref(
  businessSlug: string,
  options: { searchText?: string; category?: string; page?: number } = {},
): string {
  const params = new URLSearchParams();
  if (options.searchText) params.set('searchText', options.searchText);
  if (options.category) params.set('category', options.category);
  if (options.page && options.page > 1) params.set('page', String(options.page));
  const query = params.toString();
  return `/negocio/${businessSlug}${query ? `?${query}` : ''}`;
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
    },
  };
}

export default async function BusinessProfilePage({ params, searchParams }: BusinessPageProps) {
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
  const initials = business.name.slice(0, 2).toUpperCase();
  const activeCategory = business.categories.find((item) => item.slug === category);

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
            degradado del tema de la vertical, nunca una imagen inventada. */}
        <header className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="relative">
            {business.coverUrl ? (
              // Servida por el API en otro origen: no pasa por el optimizador de Next.
              <img
                src={business.coverUrl}
                alt={`Portada de ${business.name}`}
                className="h-40 w-full object-cover sm:h-56"
              />
            ) : (
              <div
                aria-hidden="true"
                className={`h-40 w-full bg-gradient-to-br sm:h-56 ${theme.coverGradient}`}
              />
            )}
            <span
              className={`absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${theme.accentText}`}
            >
              {business.verticalName}
            </span>
          </div>

          <div className="relative px-5 pb-6 sm:px-8">
            <div className="-mt-10 flex flex-wrap items-end gap-4 sm:-mt-12">
              {business.logoUrl ? (
                // Servida por el API en otro origen: no pasa por el optimizador de Next.
                <img
                  src={business.logoUrl}
                  alt={`Logo de ${business.name}`}
                  className="h-20 w-20 rounded-2xl border-4 border-white bg-white object-cover shadow-sm sm:h-24 sm:w-24"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className={`flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white text-xl font-semibold text-white shadow-sm sm:h-24 sm:w-24 ${theme.accentBg}`}
                >
                  {initials}
                </div>
              )}

              <div className="min-w-0 flex-1 pb-1">
                <h1 className="truncate text-2xl font-semibold text-stone-900">{business.name}</h1>
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

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
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
            <p className="mt-3 text-xs text-stone-500">
              El formulario deja tus datos al negocio. El contacto y el pago se acuerdan
              directamente con el negocio, fuera de la plataforma.
            </p>
          </div>
        </header>

        {/* Buscador y filtros propios de la tienda */}
        <section aria-labelledby="catalogo-tienda" className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="catalogo-tienda" className="text-lg font-semibold text-stone-900">
                Catálogo de la tienda
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                {business.listings.total}{' '}
                {business.listings.total === 1 ? 'publicación' : 'publicaciones'}
                {activeCategory ? ` en ${activeCategory.name}` : ''}
                {searchText ? ` para «${searchText}»` : ''}.
              </p>
            </div>
          </div>

          <form
            action={`/negocio/${business.slug}`}
            method="get"
            role="search"
            className="mt-4 flex flex-col gap-2 sm:flex-row"
          >
            {category ? <input type="hidden" name="category" value={category} /> : null}
            <label htmlFor="store-search" className="sr-only">
              Buscar en esta tienda
            </label>
            <input
              id="store-search"
              type="search"
              name="searchText"
              defaultValue={searchText ?? ''}
              placeholder="Buscar en esta tienda…"
              className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500 sm:max-w-md"
            />
            <button
              type="submit"
              className={`rounded-lg px-5 py-3 text-sm font-semibold text-white ${theme.accentBg} ${theme.accentHover}`}
            >
              Buscar
            </button>
            {searchText || category ? (
              <Link
                href={`/negocio/${business.slug}`}
                className="rounded-lg border border-stone-300 px-5 py-3 text-center text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Limpiar
              </Link>
            ) : null}
          </form>

          {business.categories.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Categorías de la tienda">
              <li>
                <Link
                  href={storeHref(business.slug, { searchText })}
                  aria-current={!category ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${
                    !category
                      ? `${theme.softBg} ${theme.softBorder} ${theme.accentText}`
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Todo
                  <span className="text-xs text-stone-500">{business.listings.total}</span>
                </Link>
              </li>
              {business.categories.map((item) => (
                <li key={item.id}>
                  <Link
                    href={storeHref(business.slug, { searchText, category: item.slug })}
                    aria-current={category === item.slug ? 'page' : undefined}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${
                      category === item.slug
                        ? `${theme.softBg} ${theme.softBorder} ${theme.accentText}`
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {item.name}
                    <span className="text-xs text-stone-500">{item.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-6">
            <ListingGrid listings={business.listings.items} />
          </div>

          {business.listings.totalPages > 1 ? (
            <nav
              aria-label="Paginación del catálogo de la tienda"
              className="mt-6 flex items-center justify-between"
            >
              {page > 1 ? (
                <Link
                  href={storeHref(business.slug, { searchText, category, page: page - 1 })}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  Anterior
                </Link>
              ) : (
                <span aria-hidden="true" />
              )}
              <span className="text-sm text-stone-500">
                Página {page} de {business.listings.totalPages}
              </span>
              {page < business.listings.totalPages ? (
                <Link
                  href={storeHref(business.slug, { searchText, category, page: page + 1 })}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  Siguiente
                </Link>
              ) : (
                <span aria-hidden="true" />
              )}
            </nav>
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
    </PublicShell>
  );
}
