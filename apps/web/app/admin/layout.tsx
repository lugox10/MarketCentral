'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiError, getJson, postJson } from '../../src/lib/api';
import { Badge, buttonStyles, cx } from '../../src/components/taxonomy-ui';

interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV: NavItem[] = [
  {
    href: '/admin',
    label: 'Panel global',
    icon: 'M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-4H4v4Zm10-11h6V4h-6v5Z',
  },
  {
    href: '/admin/negocios',
    label: 'Negocios',
    icon: 'M4 9h16l-1 11H5L4 9Zm4 0V7a4 4 0 0 1 8 0v2',
  },
  { href: '/admin/suscripciones', label: 'Suscripciones', icon: 'M3 7h18v10H3V7Zm0 4h18M7 15h3' },
  { href: '/admin/planes', label: 'Planes', icon: 'M4 7h16v10H4V7Zm4 10v3m8-3v3M8 11h8' },
  {
    href: '/admin/taxonomia',
    label: 'Taxonomía',
    icon: 'M4 6h6v5H4V6Zm10 0h6v5h-6V6ZM4 14h6v5H4v-5Zm10 0h6v5h-6v-5Z',
  },
  {
    href: '/admin/reportes',
    label: 'Reportes',
    icon: 'M12 3 2 21h20L12 3Zm0 6v6m0 3v.5',
  },
];

function Icon({ path }: { path: string }): React.ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
    >
      <path d={path} />
    </svg>
  );
}

function isActive(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === href : pathname.startsWith(href);
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const pathname = usePathname() ?? '/admin';
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [denied, setDenied] = useState(false);
  const [checking, setChecking] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const profile = await getJson<CurrentUser>('/auth/me');
        if (cancelled) return;
        setUser(profile);
        if (profile.role !== 'SUPER_ADMIN') setDenied(true);
      } catch (cause: unknown) {
        if (cancelled) return;
        // Sin sesión no se muestra ningún cartel: se sale limpiamente al login.
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/login');
          return;
        }
        setDenied(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function logout(): Promise<void> {
    try {
      await postJson('/auth/logout', {});
    } finally {
      router.replace('/login');
    }
  }

  const initials = (user?.name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  function navLinks(): React.ReactElement {
    return (
      <nav aria-label="Secciones de administración" className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                active
                  ? 'bg-white font-semibold text-stone-900'
                  : 'text-stone-300 hover:bg-stone-800 hover:text-white',
              )}
            >
              <Icon path={item.icon} />
              <span className="flex-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100">
      <aside className="hidden border-r border-stone-800 bg-stone-900 lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-xs font-bold text-stone-900">
            MC
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">MarketCentral</p>
            <p className="text-[11px] text-stone-400">Administración</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">{navLinks()}</div>
        <div className="border-t border-stone-800 p-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-stone-300 hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            ← Ir a mi panel
          </Link>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-stone-800 bg-stone-900 px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          className="rounded-md border border-stone-700 px-3 py-1.5 text-xs text-stone-200"
        >
          ☰ Menú
        </button>
        <span className="truncate text-sm font-semibold text-white">Administración</span>
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold text-stone-900"
        >
          {initials}
        </span>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-stone-950/50"
          />
          <div className="relative h-full w-72 max-w-[85%] overflow-y-auto bg-stone-900 p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Menú</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-2 py-1 text-xs text-stone-300 hover:bg-stone-800"
              >
                Cerrar
              </button>
            </div>
            {navLinks()}
            <div className="mt-4 border-t border-stone-800 pt-4">
              <p className="truncate text-sm font-medium text-white">{user?.name}</p>
              <p className="truncate text-xs text-stone-400">{user?.email}</p>
              <button
                type="button"
                onClick={() => void logout()}
                className="mt-3 w-full rounded-md border border-stone-700 px-3 py-2 text-xs text-stone-200 hover:bg-stone-800"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="hidden items-center justify-between gap-4 border-b border-stone-200 bg-white px-6 py-3 lg:flex">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-900">Panel de Administración</p>
            <p className="text-xs text-stone-500">
              Operaciones globales de MarketCentral · acceso auditado
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone="warning">SUPER_ADMIN</Badge>
            <span
              aria-hidden="true"
              className="grid h-9 w-9 place-items-center rounded-full bg-stone-900 text-xs font-semibold text-white"
            >
              {initials}
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              className={buttonStyles('ghost', 'sm')}
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
          {checking ? (
            <div aria-busy="true" aria-live="polite" className="space-y-4">
              <span className="sr-only">Comprobando permisos de administrador…</span>
              <div className="h-8 w-56 animate-pulse rounded-md bg-stone-200" />
              <div className="h-4 w-80 animate-pulse rounded-md bg-stone-200" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-xl border border-stone-200 bg-white"
                  />
                ))}
              </div>
              <div className="h-64 animate-pulse rounded-xl border border-stone-200 bg-white" />
            </div>
          ) : denied ? (
            <div
              role="alert"
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              Esta sección es solo para administradores de la plataforma.
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
