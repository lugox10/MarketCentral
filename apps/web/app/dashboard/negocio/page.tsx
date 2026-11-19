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

interface ProfileValues {
  name: string;
  city: AmvaCity;
  addressLine: string;
  whatsapp: string;
}

const INPUT_CLASS = 'mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm';

/**
 * Formulario de datos del negocio. Mantiene sus propios campos para que
 * escribir no vuelva a renderizar las tarjetas de suscripción de la página.
 */
function BusinessProfileForm({
  initial,
  onSave,
}: {
  initial: ProfileValues;
  onSave: (values: ProfileValues) => Promise<string | null>;
}): React.ReactElement {
  const [values, setValues] = useState<ProfileValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function patch(next: Partial<ProfileValues>): void {
    setValues((current) => ({ ...current, ...next }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (values.name.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    if (values.addressLine.trim().length < 5) {
      setError('La dirección debe tener al menos 5 caracteres.');
      return;
    }

    setSaving(true);
    setError(null);
    const failure = await onSave(values);
    setSaving(false);
    if (failure) setError(failure);
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-stone-800">
          Nombre
        </label>
        <input
          id="name"
          required
          minLength={2}
          maxLength={80}
          value={values.name}
          onChange={(event) => patch({ name: event.target.value })}
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <label htmlFor="city" className="block text-sm font-medium text-stone-800">
          Municipio
        </label>
        <select
          id="city"
          value={values.city}
          onChange={(event) => patch({ city: event.target.value as AmvaCity })}
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
          value={values.addressLine}
          onChange={(event) => patch({ addressLine: event.target.value })}
          className={INPUT_CLASS}
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
          value={values.whatsapp}
          onChange={(event) => patch({ whatsapp: event.target.value })}
          className={INPUT_CLASS}
        />
      </div>

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
  );
}

export default function BusinessPanelPage(): React.ReactElement {
  const router = useRouter();
  const [data, setData] = useState<MyBusiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getJson<MyBusiness>('/businesses/me')
      .then((mine) => {
        if (cancelled) return;
        setData(mine);
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

  async function handleSave(values: ProfileValues): Promise<string | null> {
    setError(null);
    setNotice(null);
    try {
      const updated = await patchJson<MyBusiness>('/businesses/me', {
        name: values.name.trim(),
        city: values.city,
        addressLine: values.addressLine.trim(),
        whatsapp: values.whatsapp.trim(),
      });
      setData(updated);
      setNotice('Cambios guardados.');
      return null;
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace('/login');
        return null;
      }
      return cause instanceof ApiError ? cause.message : 'No se pudo guardar.';
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-sm text-stone-600">Cargando tu negocio…</p>
      </div>
    );
  }

  const { business, subscription } = data;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
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

        {notice ? (
          <p
            role="status"
            className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          >
            {notice}
          </p>
        ) : null}

        <BusinessProfileForm
          initial={{
            name: business.name,
            city: business.city,
            addressLine: business.addressLine ?? '',
            whatsapp: business.whatsapp,
          }}
          onSave={handleSave}
        />
      </section>
    </div>
  );
}
