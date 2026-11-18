'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ApiError, getJson } from '../../src/lib/api';
import { cityLabel, type AdminBusiness } from '../../src/lib/business';
import type { AdminSubscriptionPage } from '../../src/lib/subscription';
import { Badge, StatCard } from '../../src/components/taxonomy-ui';

export default function AdminHomePage(): React.ReactElement {
  const [businesses, setBusinesses] = useState<AdminBusiness[] | null>(null);
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [list, subs] = await Promise.all([
          getJson<AdminBusiness[]>('/admin/businesses'),
          getJson<AdminSubscriptionPage>('/admin/subscriptions?limit=1'),
        ]);
        if (cancelled) return;
        setBusinesses(list);
        setSubscriptions(subs);
      } catch (cause: unknown) {
        if (cancelled) return;
        setError(
          cause instanceof ApiError && cause.status === 403
            ? 'Esta sección es solo para administradores de la plataforma.'
            : 'No se pudo cargar el resumen de la plataforma.',
        );
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const suspended = businesses?.filter((row) => row.status === 'SUSPENDED').length ?? 0;
  const recent = (businesses ?? []).slice(-5).reverse();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900">Panel global</h1>
        <p className="mt-1 text-sm text-stone-600">
          Estado general de la plataforma, negocios y suscripciones.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Negocios"
          value={businesses === null ? '—' : String(businesses.length)}
          hint="Registrados en todas las verticales"
        />
        <StatCard
          label="Suspendidos"
          value={businesses === null ? '—' : String(suspended)}
          hint="Ocultos del catálogo público"
        />
        <StatCard
          label="Suscripciones"
          value={subscriptions === null ? '—' : String(subscriptions.total)}
          hint="Una por negocio"
        />
        <StatCard label="Verticales" value="1" hint="Prenderías en Medellín" />
      </div>

      <section className="rounded-xl border border-stone-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-stone-900">Últimos negocios</h2>
          <Link
            href="/admin/negocios"
            className="text-xs font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            Ver todos →
          </Link>
        </div>
        {businesses === null ? (
          <p className="px-5 py-6 text-sm text-stone-600">Cargando…</p>
        ) : recent.length === 0 ? (
          <p className="px-5 py-6 text-sm text-stone-600">
            Todavía no hay negocios registrados. Los negocios nuevos aparecerán aquí.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {recent.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-900">{row.name}</p>
                  <p className="truncate text-xs text-stone-500">
                    {cityLabel(row.city)} · {row.whatsapp}
                  </p>
                </div>
                <Badge tone={row.status === 'APPROVED' ? 'success' : 'warning'}>
                  {row.status === 'APPROVED' ? 'Activo' : 'Suspendido'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/admin/suscripciones"
          className="rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <p className="text-sm font-semibold text-stone-900">Suscripciones</p>
          <p className="mt-1 text-xs text-stone-600">
            Activa planes manuales, renueva periodos y ajusta pruebas.
          </p>
        </Link>
        <Link
          href="/admin/negocios"
          className="rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <p className="text-sm font-semibold text-stone-900">Negocios</p>
          <p className="mt-1 text-xs text-stone-600">Revisa y suspende negocios registrados.</p>
        </Link>
        <Link
          href="/admin/taxonomia"
          className="rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <p className="text-sm font-semibold text-stone-900">Taxonomía</p>
          <p className="mt-1 text-xs text-stone-600">
            Verticales, categorías y atributos configurables.
          </p>
        </Link>
      </section>
    </div>
  );
}
