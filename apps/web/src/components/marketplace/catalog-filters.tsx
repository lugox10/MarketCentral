import Link from 'next/link';

import { CITY_LABELS, CONDITION_LABELS } from '@/lib/public-catalog';
import type { PublicVertical } from '@/lib/public-catalog';

const inputClass =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 shadow-sm focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20';

export interface CatalogSearchParams {
  city?: string;
  condition?: string;
  minPrice?: string;
  maxPrice?: string;
  searchText?: string;
  category?: string;
  page?: string;
}

interface CatalogFiltersProps {
  action: string;
  vertical: PublicVertical | null;
  values: CatalogSearchParams;
  categories?: Array<{ slug: string; name: string }>;
}

/**
 * Filtros del catálogo como formulario GET: funcionan sin JavaScript y cada
 * combinación tiene una URL propia (compartible e indexable).
 */
export function CatalogFilters({ action, vertical, values, categories = [] }: CatalogFiltersProps) {
  return (
    <form
      action={action}
      method="get"
      className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {categories.length > 0 ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
            Categoría
            <select name="category" defaultValue={values.category ?? ''} className={inputClass}>
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600 lg:col-span-2">
          Buscar
          <input
            type="search"
            name="searchText"
            defaultValue={values.searchText ?? ''}
            maxLength={100}
            placeholder="Título o descripción"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Ciudad
          <select name="city" defaultValue={values.city ?? ''} className={inputClass}>
            <option value="">Todas</option>
            {Object.entries(CITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Condición
          <select name="condition" defaultValue={values.condition ?? ''} className={inputClass}>
            <option value="">Cualquiera</option>
            {Object.entries(CONDITION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
            Precio mín.
            <input
              type="number"
              name="minPrice"
              min={0}
              max={1_000_000_000}
              step={1000}
              defaultValue={values.minPrice ?? ''}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
            Precio máx.
            <input
              type="number"
              name="maxPrice"
              min={0}
              max={1_000_000_000}
              step={1000}
              defaultValue={values.maxPrice ?? ''}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        >
          Aplicar filtros
        </button>
        <Link
          href={action}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          Limpiar
        </Link>
        {vertical ? (
          <span className="text-xs text-stone-500">
            {vertical.listingCount} publicaciones activas en {vertical.name}
          </span>
        ) : null}
      </div>
    </form>
  );
}
