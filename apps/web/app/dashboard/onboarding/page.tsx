'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ApiError, postJson } from '../../../src/lib/api';
import {
  AMVA_CITIES,
  AMVA_CITY_LABELS,
  type AmvaCity,
  type MyBusiness,
} from '../../../src/lib/business';

const INITIAL = {
  name: '',
  city: 'MEDELLIN' as AmvaCity,
  addressLine: '',
  whatsapp: '',
};

export default function OnboardingPage(): React.ReactElement {
  const router = useRouter();
  const [form, setForm] = useState(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof typeof INITIAL>(key: K, value: (typeof INITIAL)[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await postJson<MyBusiness>('/businesses', {
        name: form.name,
        city: form.city,
        addressLine: form.addressLine.trim() === '' ? null : form.addressLine,
        whatsapp: form.whatsapp,
      });
      router.replace('/dashboard/negocio');
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace('/login');
        return;
      }
      if (cause instanceof ApiError && cause.status === 409) {
        router.replace('/dashboard/negocio');
        return;
      }
      setError(cause instanceof ApiError ? cause.message : 'No se pudo crear el negocio.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-stone-900">Crea tu negocio</h1>
      <p className="mt-1 text-sm text-stone-600">
        Con estos datos aparecerás en el catálogo público. Empiezas con el plan Free.
      </p>

      <form onSubmit={(event) => void submit(event)} className="mt-8 space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-stone-800">
            Nombre del negocio
          </label>
          <input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={80}
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            placeholder="Prendería La 70"
          />
        </div>

        <div>
          <label htmlFor="city" className="block text-sm font-medium text-stone-800">
            Municipio
          </label>
          <select
            id="city"
            name="city"
            value={form.city}
            onChange={(event) => update('city', event.target.value as AmvaCity)}
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
            Dirección <span className="font-normal text-stone-500">(opcional)</span>
          </label>
          <input
            id="addressLine"
            name="addressLine"
            maxLength={160}
            value={form.addressLine}
            onChange={(event) => update('addressLine', event.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            placeholder="Calle 70 # 45-12, local 3"
          />
        </div>

        <div>
          <label htmlFor="whatsapp" className="block text-sm font-medium text-stone-800">
            WhatsApp comercial
          </label>
          <input
            id="whatsapp"
            name="whatsapp"
            required
            inputMode="tel"
            value={form.whatsapp}
            onChange={(event) => update('whatsapp', event.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            placeholder="3001234567"
          />
          <p className="mt-1 text-xs text-stone-500">
            Celular colombiano de 10 dígitos; se guarda como +57…
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
          className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
        >
          {saving ? 'Creando…' : 'Crear negocio'}
        </button>
      </form>
    </div>
  );
}
