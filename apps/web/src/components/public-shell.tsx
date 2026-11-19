import Link from 'next/link';

import type { PublicVertical } from '@/lib/public-catalog';

interface PublicShellProps {
  children: React.ReactNode;
  verticals?: PublicVertical[];
  /** Mantiene el footer al fondo del viewport. Desactivarlo en páginas compactas como la landing. */
  fillViewport?: boolean;
}

/**
 * Nombre legible de la vertical. Respeta el nombre exacto que definió el
 * administrador; solo normaliza los que llegan TODO EN MAYÚSCULAS (dato viejo de
 * los primeros seeds), porque esos sí se ven como un grito en el header.
 */
function verticalLabel(name: string): string {
  const trimmed = name.trim();
  const isAllCaps = /\p{L}/u.test(trimmed) && trimmed === trimmed.toLocaleUpperCase('es-CO');

  if (!isAllCaps) return trimmed;

  return trimmed
    .toLocaleLowerCase('es-CO')
    .replace(/(^|\s)\S/gu, (letter) => letter.toLocaleUpperCase('es-CO'));
}

/**
 * Cabecera y pie del sitio público (landing, marketplace, detalle y tiendas).
 * Nunca recibe verticales escritas a mano: siempre vienen de la API pública.
 */
export function PublicShell({ children, verticals = [], fillViewport = true }: PublicShellProps) {
  const shellClassName = fillViewport
    ? 'flex min-h-screen flex-col bg-stone-50 text-stone-900'
    : 'flex flex-col bg-stone-50 text-stone-900';

  return (
    <div className={shellClassName}>
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700 text-sm font-bold text-white">
              MC
            </span>
            <span className="text-base font-semibold text-stone-900">MarketCentral</span>
          </Link>

          <nav
            aria-label="Navegación principal"
            className="hidden flex-1 items-center gap-1 text-sm md:flex"
          >
            <Link
              href="/marketplace"
              className="rounded-md px-3 py-2 font-medium text-stone-700 hover:bg-stone-100"
            >
              Catálogo
            </Link>
            {verticals.slice(0, 3).map((vertical) => (
              <Link
                key={vertical.id}
                href={`/marketplace/${vertical.slug}`}
                className="rounded-md px-3 py-2 text-stone-600 hover:bg-stone-100"
              >
                {verticalLabel(vertical.name)}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              Ingresar
            </Link>
            <Link
              href="/register"
              className="whitespace-nowrap rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-900 sm:px-4"
            >
              Publicar mi negocio
            </Link>
          </div>
        </div>

        <div className="border-t border-stone-100 md:hidden">
          <nav
            aria-label="Navegación por verticales"
            className="-mx-1 flex gap-1 overflow-x-auto px-3 py-2 text-sm"
          >
            <Link
              href="/marketplace"
              className="shrink-0 rounded-md px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-100"
            >
              Catálogo
            </Link>
            {verticals.map((vertical) => (
              <Link
                key={vertical.id}
                href={`/marketplace/${vertical.slug}`}
                className="shrink-0 rounded-md px-3 py-1.5 text-stone-600 hover:bg-stone-100"
              >
                {verticalLabel(vertical.name)}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className={fillViewport ? 'flex-1' : undefined}>{children}</div>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-7 px-4 py-8 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-700 text-xs font-bold text-white">
                MC
              </span>
              <p className="text-sm font-semibold text-stone-900">MarketCentral</p>
            </div>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-stone-500">
              Un marketplace de negocios locales: reúne las publicaciones de cada comercio para que
              las personas descubran productos y contacten directamente con sus vendedores.
            </p>
          </div>

          <div className="text-xs text-stone-500">
            <p className="mb-2 font-semibold text-stone-700">Explorar</p>
            <ul className="space-y-1">
              {verticals.map((vertical) => (
                <li key={vertical.id}>
                  <Link href={`/marketplace/${vertical.slug}`} className="hover:text-brand-700">
                    {verticalLabel(vertical.name)}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/marketplace" className="hover:text-brand-700">
                  Todo el catálogo
                </Link>
              </li>
            </ul>
          </div>

          <div className="text-xs text-stone-500">
            <p className="mb-2 font-semibold text-stone-700">Para negocios</p>
            <p className="leading-relaxed">
              Crea tu cuenta, registra tu negocio y publica tu inventario con fotos.
            </p>
            <Link
              href="/register"
              className="mt-3 inline-block font-semibold text-brand-700 hover:underline"
            >
              Crear mi negocio →
            </Link>
            <p className="mt-4">
              <Link href="/login" className="hover:text-brand-700">
                Ingresar a mi panel
              </Link>
            </p>
          </div>
        </div>

        <div className="border-t border-stone-100">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-[11px] text-stone-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>© {new Date().getFullYear()} MarketCentral. Medellín y área metropolitana.</p>
            <p>No procesamos pagos de artículos ni intermediamos en la venta.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
