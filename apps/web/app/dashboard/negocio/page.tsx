'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiError, getJson, patchJson } from '../../../src/lib/api';
import {
  AMVA_CITIES,
  AMVA_CITY_LABELS,
  cityLabel,
  formatDate,
  subscriptionLabel,
  type AmvaCity,
  type MyBusiness,
} from '../../../src/lib/business';

export default function BusinessPanelPage(): React.ReactElement {
  const router = useRouter();
  const [data, setData] = useState<MyBusiness | null>(null);
  const [form, setForm] = useState({
    name: '',
    city: 'MEDELLIN' as AmvaCity,
    addressLine: '',
    whatsapp: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getJson<MyBusiness>('/businesses/me')
      .then((mine) => {
        if (cancelled) return;
        setData(mine);
        setForm({
          name: mine.business.name,
          city: mine.business.city,
          addressLine: mine.business.addressLine ?? '',
          whatsapp: mine.business.whatsapp,
        });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/login');
          return;
        }
        if (cause instanceof ApiError && cause.status === 404) {
          router.replace('/dashboard/onboarding');
          return;
        }
        setError('No se pudo cargar tu negocio.');
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const updated = await patchJson<MyBusiness>('/businesses/me', {
        name: form.name,
        city: form.city,
        addressLine: form.addressLine.trim() === '' ? null : form.addressLine,
        whatsapp: form.whatsapp,
      });
      setData(updated);
      setNotice('Cambios guardados.');
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace('/login');
        return;
      }
      setError(cause instanceof ApiError ? cause.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
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

  if (!data) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-sm text-stone-600">Cargando tu negocio…</p>
      </main>
    );
  }

  const { business, subscription } = data;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-stone-900">{business.name}</h1>
      <p className="mt-1 text-sm text-stone-600">
        {cityLabel(business.city)} ·{' '}
        <span
          className={
            business.status === 'APPROVED'
              ? 'rounded bg-emerald-50 px-2 py-0.5 text-emerald-700'
              : 'rounded bg-amber-50 px-2 py-0.5 text-amber-800'
          }
        >
          {business.status === 'APPROVED' ? 'Aprobado' : 'Suspendido'}
        </span>
      </p>

      <section className="mt-6 rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="text-base font-semibold text-stone-900">Suscripción</h2>
        <p className="mt-2 text-sm text-stone-700">{subscriptionLabel(subscription)}</p>
        {subscription ? (
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm text-stone-600 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-stone-800">Periodo actual</dt>
              <dd>
                {formatDate(subscription.currentPeriodStart)} —{' '}
                {formatDate(subscription.currentPeriodEnd)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-stone-800">Precio</dt>
              <dd>
                {subscription.plan.priceCop === 0
                  ? 'Gratis'
                  : `$${subscription.plan.priceCop.toLocaleString('es-CO')} COP${
                      subscription.plan.billingPeriodDays
                        ? ` / ${subscription.plan.billingPeriodDays} días`
                        : ''
                    }`}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-stone-800">Límite de publicaciones</dt>
              <dd>{subscription.plan.maxListings} publicaciones</dd>
            </div>
          </dl>
        ) : null}
        <Link
          href="/dashboard/suscripcion"
          className="mt-4 inline-block rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100"
        >
          Ver planes y estado de la suscripción
        </Link>
        {business.status === 'SUSPENDED' ? (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Tu negocio está suspendido: no aparece en el catálogo público. Contacta a soporte.
          </p>
        ) : null}
      </section>

      <section className="mt-6 rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="text-base font-semibold text-stone-900">Datos del negocio</h2>

        <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-stone-800">
              Nombre
            </label>
            <input
              id="name"
              required
              minLength={2}
              maxLength={80}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="city" className="block text-sm font-medium text-stone-800">
              Municipio
            </label>
            <select
              id="city"
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value as AmvaCity })}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              {AMVA_CITIES.map((city) => (
                <option key={city} value={city}>
                  {AMVA_CITY_LABELS[city]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="addressLine" className="block text-sm font-medium text-stone-800">
              Dirección
            </label>
            <input
              id="addressLine"
              maxLength={160}
              value={form.addressLine}
              onChange={(event) => setForm({ ...form, addressLine: event.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="whatsapp" className="block text-sm font-medium text-stone-800">
              WhatsApp comercial
            </label>
            <input
              id="whatsapp"
              required
              inputMode="tel"
              value={form.whatsapp}
              onChange={(event) => setForm({ ...form, whatsapp: event.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          {notice ? (
            <p
              role="status"
              className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
            >
              {notice}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </section>
    </main>
  );
}
