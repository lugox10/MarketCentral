'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiError, deleteJson, getJson, patchJson, postForm } from '../../../src/lib/api';
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
  description: string;
}

const INPUT_CLASS = 'mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm';

const IMAGE_HINTS = {
  logo: 'JPEG, PNG o WebP · mínimo 200×200 px · máximo 2 MB',
  cover: 'JPEG, PNG o WebP · mínimo 1200×600 px · máximo 5 MB',
} as const;

type ImageKind = keyof typeof IMAGE_HINTS;

/**
 * Identidad visual de la tienda: logo y portada.
 *
 * Cada imagen se sube en su propio multipart y la respuesta devuelve el negocio
 * completo, así que la vista previa se actualiza sin recargar la página.
 */
function StoreIdentitySection({
  business,
  onUpdated,
}: {
  business: MyBusiness['business'];
  onUpdated: (next: MyBusiness) => void;
}): React.ReactElement {
  const [logoUrl, setLogoUrl] = useState<string | null>(business.logoUrl);
  const [coverUrl, setCoverUrl] = useState<string | null>(business.coverUrl);
  const [busy, setBusy] = useState<ImageKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function upload(kind: ImageKind, file: File | undefined): Promise<void> {
    if (!file) return;
    setBusy(kind);
    setError(null);
    setNotice(null);

    const form = new FormData();
    form.append('file', file);

    try {
      const updated = await postForm<MyBusiness>(`/businesses/me/${kind}`, form);
      setLogoUrl(updated.business.logoUrl);
      setCoverUrl(updated.business.coverUrl);
      onUpdated(updated);
      setNotice(kind === 'logo' ? 'Logo actualizado.' : 'Portada actualizada.');
    } catch (cause: unknown) {
      if (cause instanceof ApiError) {
        if (cause.status === 413) setError('La imagen supera el tamaño máximo permitido.');
        else if (cause.code === 'INVALID_IMAGE_DIMENSIONS')
          setError(
            kind === 'logo'
              ? 'El logo debe medir al menos 200×200 px.'
              : 'La portada debe medir al menos 1200×600 px.',
          );
        else if (cause.code === 'INVALID_IMAGE_TYPE')
          setError('Formato no admitido: usa JPEG, PNG o WebP.');
        else setError(cause.message);
      } else {
        setError('No se pudo subir la imagen.');
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove(kind: ImageKind): Promise<void> {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      const updated = await deleteJson<MyBusiness>(`/businesses/me/${kind}`);
      setLogoUrl(updated.business.logoUrl);
      setCoverUrl(updated.business.coverUrl);
      onUpdated(updated);
      setNotice(kind === 'logo' ? 'Logo eliminado.' : 'Portada eliminada.');
    } catch (cause: unknown) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo quitar la imagen.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="text-base font-semibold text-stone-900">Identidad de la tienda</h2>
      <p className="mt-1 text-sm text-stone-600">
        El logo y la portada aparecen en tu tienda pública. El estilo general lo define la vertical
        del negocio.
      </p>

      {notice ? (
        <p
          role="status"
          className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 space-y-5">
        <div>
          <p className="text-sm font-medium text-stone-800">Logo</p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            {logoUrl ? (
              // Servida por el API (disco local o S3): no pasa por el optimizador.
              <img
                src={logoUrl}
                alt="Logo actual del negocio"
                className="h-20 w-20 rounded-xl border border-stone-200 bg-white object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-stone-300 text-xs text-stone-500">
                Sin logo
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50">
                {busy === 'logo' ? 'Subiendo…' : logoUrl ? 'Reemplazar logo' : 'Subir logo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={busy !== null}
                  onChange={(event) => {
                    void upload('logo', event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>
              {logoUrl ? (
                <button
                  type="button"
                  onClick={() => void remove('logo')}
                  disabled={busy !== null}
                  className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                >
                  Quitar logo
                </button>
              ) : null}
              <p className="text-xs text-stone-500">{IMAGE_HINTS.logo}</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-stone-800">Foto de portada</p>
          <div className="mt-2 space-y-3">
            {coverUrl ? (
              // Servida por el API (disco local o S3): no pasa por el optimizador.
              <img
                src={coverUrl}
                alt="Portada actual del negocio"
                className="h-32 w-full rounded-xl border border-stone-200 bg-white object-cover"
              />
            ) : (
              <div className="flex h-32 w-full items-center justify-center rounded-xl border border-dashed border-stone-300 text-xs text-stone-500">
                Sin portada: se usa el color de tu vertical
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50">
                {busy === 'cover' ? 'Subiendo…' : coverUrl ? 'Reemplazar portada' : 'Subir portada'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={busy !== null}
                  onChange={(event) => {
                    void upload('cover', event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>
              {coverUrl ? (
                <button
                  type="button"
                  onClick={() => void remove('cover')}
                  disabled={busy !== null}
                  className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                >
                  Quitar portada
                </button>
              ) : null}
            </div>
            <p className="text-xs text-stone-500">{IMAGE_HINTS.cover}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

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
    const description = values.description.trim();
    if (description.length > 0 && description.length < 20) {
      setError('La descripción debe tener al menos 20 caracteres, o quedar vacía.');
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

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-stone-800">
          Descripción de la tienda
        </label>
        <textarea
          id="description"
          rows={4}
          maxLength={600}
          value={values.description}
          onChange={(event) => patch({ description: event.target.value })}
          placeholder="Cuenta qué vendes, qué te hace distinto y cómo trabajas la garantía."
          className={INPUT_CLASS}
        />
        <p className="mt-1 flex items-center justify-between text-xs text-stone-500">
          <span>Se muestra en tu tienda pública. Déjala vacía para ocultarla.</span>
          <span className="tabular-nums">{values.description.trim().length}/600</span>
        </p>
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
        description: values.description.trim(),
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
            description: business.description ?? '',
          }}
          onSave={handleSave}
        />
      </section>

      <StoreIdentitySection business={business} onUpdated={setData} />
    </div>
  );
}
