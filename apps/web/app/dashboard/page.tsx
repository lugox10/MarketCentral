'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiError, API_URL, getJson, postJson } from '../../src/lib/api';
import { cityLabel, formatDate, subscriptionLabel, type MyBusiness } from '../../src/lib/business';

interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
}

export default function DashboardPage(): React.ReactElement {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [business, setBusiness] = useState<MyBusiness | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          if (!cancelled) setBusiness(mine);
        } catch (cause: unknown) {
          if (cause instanceof ApiError && cause.status === 404) {
            router.replace('/dashboard/onboarding');
            return;
          }
          throw cause;
        }
      } catch (cause: unknown) {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/login');
          return;
        }
        setError('No se pudo cargar tu panel. Intenta de nuevo.');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function logout(): Promise<void> {
    await postJson('/auth/logout', {});
    router.replace('/login');
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-sm text-stone-600">Cargando tu panel…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-stone-900">Hola, {user.name}</h1>
      <p className="mt-1 text-sm text-stone-600">{user.email}</p>

      {user.role === 'SUPER_ADMIN' ? (
        <section className="mt-8 rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="text-base font-semibold text-stone-900">
            Administración de la plataforma
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Revisa los negocios registrados y suspende o reactiva los que lo necesiten.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/admin/negocios"
              className="inline-block rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
            >
              Ir a negocios
            </Link>
            <Link
              href="/admin/taxonomia"
              className="inline-block rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100"
            >
              Administrar taxonomía
            </Link>
          </div>
        </section>
      ) : business ? (
        <section className="mt-8 rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="text-base font-semibold text-stone-900">{business.business.name}</h2>
          <p className="mt-1 text-sm text-stone-600">
            {cityLabel(business.business.city)} · {business.business.whatsapp}
          </p>
          <p className="mt-3 text-sm text-stone-700">
            {subscriptionLabel(business.subscription)}
            {business.subscription
              ? ` · Vence el ${formatDate(business.subscription.currentPeriodEnd)}`
              : ''}
          </p>
          {business.business.status === 'SUSPENDED' ? (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Tu negocio está suspendido: no aparece en el catálogo público.
            </p>
          ) : null}
          <Link
            href="/dashboard/negocio"
            className="mt-4 inline-block rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            Administrar mi negocio
          </Link>
        </section>
      ) : (
        <p className="mt-8 text-sm text-stone-600">Cargando tu negocio…</p>
      )}

      <button
        type="button"
        onClick={() => void logout()}
        className="mt-8 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100"
      >
        Cerrar sesión
      </button>

      <p className="mt-6 text-xs text-stone-400">API: {API_URL}</p>
    </main>
  );
}
