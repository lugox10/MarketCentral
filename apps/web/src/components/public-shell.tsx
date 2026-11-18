import Link from 'next/link';

import type { PublicVertical } from '@/lib/public-catalog';

interface PublicShellProps {
  children: React.ReactNode;
  verticals?: PublicVertical[];
}

/** Cabecera y pie del sitio público (marketplace, detalle y perfiles). */
export function PublicShell({ children, verticals = [] }: PublicShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="mr-2 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700 text-sm font-bold text-white">
              MC
            </span>
            <span className="text-base font-semibold text-stone-900">MarketCentral</span>
          </Link>

          <nav
            aria-label="Navegación principal"
            className="flex flex-1 flex-wrap items-center gap-1 text-sm"
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
                {vertical.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              Ingresar
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
            >
              Publica tu negocio
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-stone-900">MarketCentral</p>
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              Marketplace de prenderías de Medellín y el Valle de Aburrá. El catálogo reúne las
              publicaciones de cada negocio; la compra y el pago se acuerdan directamente con el
              negocio, fuera de la plataforma.
            </p>
          </div>

          <div className="text-xs text-stone-500">
            <p className="mb-2 font-semibold text-stone-700">Explorar</p>
            <ul className="space-y-1">
              {verticals.map((vertical) => (
                <li key={vertical.id}>
                  <Link href={`/marketplace/${vertical.slug}`} className="hover:text-brand-700">
                    {vertical.name}
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
            <p className="mb-2 font-semibold text-stone-700">¿Tienes una prendería?</p>
            <p className="leading-relaxed">
              Publica gratis durante dos meses: crea tu cuenta, registra tu negocio y sube tus
              artículos con fotos.
            </p>
            <Link
              href="/register"
              className="mt-3 inline-block font-semibold text-brand-700 hover:underline"
            >
              Crear mi negocio →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
