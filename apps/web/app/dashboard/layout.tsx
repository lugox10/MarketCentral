'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiError, getJson, postJson } from '../../src/lib/api';
import type { MyBusiness } from '../../src/lib/business';
import { fetchLeadSummary } from '../../src/lib/leads';
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
  soon?: boolean;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Inicio', icon: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5' },
  {
    href: '/dashboard/leads',
    label: 'Contactos',
    icon: 'M4 6h16v12H4V6Zm0 1 8 6 8-6',
  },
  {
    href: '/dashboard/negocio',
    label: 'Mi negocio',
    icon: 'M4 9h16l-1 11H5L4 9Zm4 0V7a4 4 0 0 1 8 0v2',
  },
  { href: '/dashboard/suscripcion', label: 'Suscripción', icon: 'M3 7h18v10H3V7Zm0 4h18M7 15h3' },
  {
    href: '/dashboard/categorias',
    label: 'Categorías',
    icon: 'M4 5h7v6H4V5Zm9 0h7v6h-7V5ZM4 13h7v6H4v-6Zm9 0h7v6h-7v-6Z',
  },
  {
    href: '/dashboard/inventario',
    label: 'Inventario',
    icon: 'm3 8 9-5 9 5v8l-9 5-9-5V8Zm9-5v18M3 8l9 5 9-5',
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
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const pathname = usePathname() ?? '/dashboard';
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [unreadLeads, setUnreadLeads] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const profile = await getJson<CurrentUser>('/auth/me');
        if (cancelled) return;
        setUser(profile);
        if (profile.role === 'SUPER_ADMIN') return;
        try {
          const mine = await getJson<MyBusiness>('/businesses/me');
          if (!cancelled) setBusinessName(mine.business.name);
          try {
            const summary = await fetchLeadSummary();
            if (!cancelled) setUnreadLeads(summary.unreadCount);
          } catch {
            // El contador es informativo: si falla, el menú sigue funcionando.
          }
        } catch {
          // Un usuario sin negocio (onboarding) no debe romper el layout.
        }
      } catch (cause: unknown) {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) router.replace('/login');
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
      <nav aria-label="Secciones del panel" className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const content = (
            <>
              <Icon path={item.icon} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.href === '/dashboard/leads' && unreadLeads > 0 ? (
                <span
                  aria-label={`${unreadLeads} contactos sin leer`}
                  className="rounded-full bg-brand-700 px-2 py-0.5 text-[11px] font-semibold text-white"
                >
                  {unreadLeads > 9 ? '9+' : unreadLeads}
                </span>
              ) : null}
              {item.soon ? <Badge tone="outline">Pronto</Badge> : null}
            </>
          );
          return item.soon ? (
            <span
              key={item.href}
              aria-disabled="true"
              title="Disponible próximamente"
              className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-400"
            >
              {content}
            </span>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700',
                active
                  ? 'bg-brand-50 font-semibold text-brand-900'
                  : 'text-stone-700 hover:bg-stone-100',
              )}
            >
              {content}
            </Link>
          );
        })}
        {user?.role === 'SUPER_ADMIN' ? (
          <Link
            href="/admin"
            onClick={() => setMenuOpen(false)}
            className="mt-2 flex items-center gap-3 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <Icon path="M12 3v18M3 12h18" />
            <span className="flex-1 truncate">Panel admin</span>
          </Link>
        ) : null}
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <aside className="hidden border-r border-stone-200 bg-white lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-700 text-sm font-bold text-white">
            MC
          </span>
          <span className="text-sm font-semibold text-stone-900">MarketCentral</span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">{navLinks()}</div>
        <div className="border-t border-stone-200 p-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-stone-600 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            ← Volver al sitio
          </Link>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          className={buttonStyles('secondary', 'sm')}
        >
          <span aria-hidden="true">☰</span> Menú
        </button>
        <span className="truncate text-sm font-semibold text-stone-900">
          {businessName ?? 'MarketCentral'}
        </span>
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-stone-900 text-xs font-semibold text-white"
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
            className="absolute inset-0 bg-stone-950/40"
          />
          <div className="relative h-full w-72 max-w-[85%] overflow-y-auto bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-stone-900">Menú</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className={buttonStyles('ghost', 'sm')}
              >
                Cerrar
              </button>
            </div>
            {navLinks()}
            <div className="mt-4 border-t border-stone-200 pt-4">
              <p className="truncate text-sm font-medium text-stone-900">{user?.name}</p>
              <p className="truncate text-xs text-stone-500">{user?.email}</p>
              <button
                type="button"
                onClick={() => void logout()}
                className={cx(buttonStyles('secondary', 'sm'), 'mt-3 w-full')}
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
            <p className="truncate text-sm font-semibold text-stone-900">
              {businessName ?? 'Mi cuenta'}
            </p>
            <p className="truncate text-xs text-stone-500">{user?.email}</p>
          </div>
          <div className="flex items-center gap-3">
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
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
