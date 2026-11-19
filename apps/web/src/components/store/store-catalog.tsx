import Link from 'next/link';

import { ListingGrid } from '@/components/marketplace/listing-card';
import type { PublicBusiness } from '@/lib/public-catalog';
import type { VerticalTheme } from '@/lib/vertical-theme';

/**
 * Catálogo interno de una tienda.
 *
 * Vive separado de la portada de la tienda porque se usa en tres rutas:
 * `/negocio/[slug]` (vista general), `/negocio/[slug]/catalogo` (catálogo
 * completo) y `/negocio/[slug]/categoria/[categorySlug]` (categoría concreta).
 * El filtrado lo resuelve el API; aquí solo se pinta la navegación.
 */
export function StoreCatalog({
  business,
  theme,
  activeCategorySlug,
  searchText,
  page,
}: {
  business: PublicBusiness;
  theme: VerticalTheme;
  activeCategorySlug?: string;
  searchText?: string;
  page: number;
}): React.ReactElement {
  const activeCategory = business.categories.find((item) => item.slug === activeCategorySlug);
  // `listings.total` viene filtrado por categoría; la suma de conteos de las
  // categorías es el total visible real de la tienda (toda publicación tiene
  // categoría), que es lo que debe mostrar el chip «Todo».
  const totalVisible = business.categories.reduce((sum, item) => sum + item.count, 0);
  const basePath = activeCategorySlug
    ? `/negocio/${business.slug}/categoria/${activeCategorySlug}`
    : `/negocio/${business.slug}/catalogo`;

  const pageHref = (target: number): string => {
    const params = new URLSearchParams();
    if (searchText) params.set('searchText', searchText);
    if (target > 1) params.set('page', String(target));
    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ''}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-stone-900 sm:text-xl">
            {activeCategory ? activeCategory.name : 'Catálogo de la tienda'}
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            {business.listings.total}{' '}
            {business.listings.total === 1 ? 'publicación' : 'publicaciones'}
            {activeCategory ? ` en ${activeCategory.name}` : ''}
            {searchText ? ` para «${searchText}»` : ''}.
          </p>
        </div>
      </div>

      {/* Buscador de la tienda: formulario GET, funciona sin JavaScript. */}
      <form
        action={`/negocio/${business.slug}/catalogo`}
        method="get"
        role="search"
        className="mt-4 flex flex-col gap-2 sm:flex-row"
      >
        {activeCategorySlug ? (
          <input type="hidden" name="category" value={activeCategorySlug} />
        ) : null}
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
        <div className="flex gap-2">
          <button
            type="submit"
            className={`flex-1 rounded-lg px-5 py-3 text-sm font-semibold text-white sm:flex-none ${theme.accentBg} ${theme.accentHover}`}
          >
            Buscar
          </button>
          {searchText ? (
            <Link
              href={`/negocio/${business.slug}/catalogo`}
              className="flex-1 rounded-lg border border-stone-300 px-5 py-3 text-center text-sm font-medium text-stone-700 hover:bg-stone-50 sm:flex-none"
            >
              Limpiar
            </Link>
          ) : null}
        </div>
      </form>

      {business.categories.length > 0 ? (
        <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
          <ul
            className="flex w-max gap-2 sm:w-auto sm:flex-wrap"
            aria-label="Categorías de la tienda"
          >
            <li>
              <Link
                href={`/negocio/${business.slug}/catalogo`}
                aria-current={!activeCategorySlug ? 'page' : undefined}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium ${
                  !activeCategorySlug
                    ? `${theme.softBg} ${theme.softBorder} ${theme.accentText}`
                    : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                }`}
              >
                Todo
                <span className="text-xs text-stone-500">{totalVisible}</span>
              </Link>
            </li>
            {business.categories.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/negocio/${business.slug}/categoria/${item.slug}`}
                  aria-current={activeCategorySlug === item.slug ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium ${
                    activeCategorySlug === item.slug
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
        </div>
      ) : null}

      <div className="mt-6">
        <ListingGrid listings={business.listings.items} />
      </div>

      {business.listings.totalPages > 1 ? (
        <nav
          aria-label="Paginación del catálogo de la tienda"
          className="mt-6 flex items-center justify-between gap-2"
        >
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
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
              href={pageHref(page + 1)}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Siguiente
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
        </nav>
      ) : null}
    </div>
  );
}
