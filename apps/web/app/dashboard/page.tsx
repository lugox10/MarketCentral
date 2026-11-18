'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiError, getJson } from '../../src/lib/api';
import { cityLabel, formatDate, subscriptionLabel, type MyBusiness } from '../../src/lib/business';
import { Badge, buttonStyles } from '../../src/components/taxonomy-ui';

interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: string;
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

  if (error) {
    return (
      <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  }

  if (!user) {
    return <p className="text-sm text-stone-600">Cargando tu panel…</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900">Hola, {user.name.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-stone-600">{user.email}</p>
      </header>

      {user.role === 'SUPER_ADMIN' ? (
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="text-base font-semibold text-stone-900">
            Administración de la plataforma
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Revisa negocios, suscripciones y la taxonomía global.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/admin" className={buttonStyles('primary', 'sm')}>
              Ir al panel admin
            </Link>
          </div>
        </section>
      ) : business ? (
        <>
          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-stone-900">
                  {business.business.name}
                </h2>
                <p className="mt-1 truncate text-sm text-stone-600">
                  {cityLabel(business.business.city)} · {business.business.whatsapp}
                </p>
              </div>
              <Badge tone={business.business.status === 'APPROVED' ? 'success' : 'warning'}>
                {business.business.status === 'APPROVED' ? 'Negocio activo' : 'Suspendido'}
              </Badge>
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-stone-50 px-3 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-stone-500">Suscripción</dt>
                <dd className="mt-0.5 text-sm text-stone-900">
                  {subscriptionLabel(business.subscription)}
                </dd>
              </div>
              <div className="rounded-lg bg-stone-50 px-3 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-stone-500">Vence</dt>
                <dd className="mt-0.5 text-sm text-stone-900">
                  {business.subscription
                    ? formatDate(business.subscription.currentPeriodEnd)
                    : 'Sin periodo activo'}
                </dd>
              </div>
            </dl>

            {business.business.status === 'SUSPENDED' ? (
              <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Tu negocio está suspendido: no aparece en el catálogo público.
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/dashboard/negocio" className={buttonStyles('primary', 'sm')}>
                Administrar mi negocio
              </Link>
              <Link href="/dashboard/suscripcion" className={buttonStyles('secondary', 'sm')}>
                Ver plan y suscripción
              </Link>
            </div>
          </section>

          <section className="rounded-xl border border-dashed border-stone-300 bg-white p-5">
            <h2 className="text-sm font-semibold text-stone-900">Publica tu primer artículo</h2>
            <p className="mt-1 text-sm text-stone-600">
              El inventario con fotos, precio y atributos estará disponible en la próxima fase. Te
              avisaremos aquí cuando puedas publicar.
            </p>
            <span className="mt-3 inline-flex items-center gap-2 rounded-md bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600">
              Próximamente
            </span>
          </section>
        </>
      ) : (
        <p className="text-sm text-stone-600">Cargando tu negocio…</p>
      )}
    </div>
  );
}
