'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { Modal } from '../../../src/components/modal';
import {
  Badge,
  Banner,
  EmptyState,
  Field,
  SkeletonList,
  StatCard,
  buttonStyles,
  cx,
  inputStyles,
} from '../../../src/components/taxonomy-ui';
import {
  categoryErrorMessage,
  createBusinessCategory,
  fetchBusinessCategories,
  updateBusinessCategory,
} from '../../../src/lib/business-categories';
import type { BusinessCategoryList } from '../../../src/lib/business-categories';

export default function BusinessCategoriesPage(): React.ReactElement {
  const [data, setData] = useState<BusinessCategoryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async (): Promise<void> => {
    setError('');
    try {
      setData(await fetchBusinessCategories());
    } catch (caught) {
      setError(categoryErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const active = useMemo(() => data?.items.filter((item) => item.isActive) ?? [], [data]);
  const inactive = useMemo(() => data?.items.filter((item) => !item.isActive) ?? [], [data]);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      setData(await createBusinessCategory({ name }));
      setName('');
      setShowCreate(false);
      setNotice('Categoría creada. Ya puedes usarla en tus publicaciones.');
    } catch (caught) {
      setFormError(categoryErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, isActive: boolean): Promise<void> => {
    setError('');
    try {
      setData(await updateBusinessCategory(id, { isActive }));
      setNotice(isActive ? 'Categoría reactivada.' : 'Categoría desactivada; el cupo quedó libre.');
    } catch (caught) {
      setError(categoryErrorMessage(caught));
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <nav aria-label="Ruta de navegación" className="text-xs text-stone-500">
            <Link href="/dashboard" className="hover:text-brand-700">
              Inicio
            </Link>{' '}
            / Categorías
          </nav>
          <h1 className="mt-1 text-2xl font-semibold text-stone-900">Categorías propias</h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">
            Ordena tu inventario con nombres de tu negocio, además de las categorías globales de tu
            vertical. Solo tú puedes publicar en ellas.
          </p>
        </div>
        <button
          type="button"
          className={buttonStyles('primary')}
          onClick={() => setShowCreate(true)}
          disabled={!data?.canCreate}
        >
          Nueva categoría
        </button>
      </header>

      {notice ? <Banner tone="success" message={notice} onDismiss={() => setNotice('')} /> : null}
      {error ? <Banner tone="error" message={error} onDismiss={() => setError('')} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Categorías activas" value={loading ? '—' : String(data?.used ?? 0)} />
        <StatCard label="Cupo del plan" value={loading ? '—' : String(data?.limit ?? 0)} />
        <StatCard
          label="Plan actual"
          value={data?.planCode ?? '—'}
          hint={data && data.limit === 0 ? 'Mejora a Base o Pro' : undefined}
        />
      </div>

      {data && data.limit === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Tu plan no incluye categorías propias.</p>
          <p className="mt-1 text-amber-800">{data.upgradeHint}</p>
          <Link href="/dashboard/suscripcion" className="mt-2 inline-block font-medium underline">
            Ver planes
          </Link>
        </div>
      ) : null}

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900">Activas ({active.length})</h2>
          {data && data.limit > 0 ? (
            <span className="text-xs text-stone-500">
              {data.used} de {data.limit} en uso
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="mt-3">
            <SkeletonList rows={3} />
          </div>
        ) : active.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="Sin categorías propias"
              description="Crea una categoría para agrupar tus publicaciones con un nombre propio."
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {active.map((category) => (
              <li
                key={category.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-900">{category.name}</p>
                  <p className="truncate font-mono text-[11px] text-stone-500">/{category.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="success">Activa</Badge>
                  <button
                    type="button"
                    className={cx(buttonStyles('ghost', 'sm'))}
                    onClick={() => void toggle(category.id, false)}
                  >
                    Desactivar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {inactive.length > 0 ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-900">Inactivas ({inactive.length})</h2>
          <p className="mt-1 text-xs text-stone-500">
            No se borran: conservan su historial y puedes reactivarlas si tienes cupo.
          </p>
          <ul className="mt-3 divide-y divide-stone-100">
            {inactive.map((category) => (
              <li
                key={category.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-500">{category.name}</p>
                  <p className="truncate font-mono text-[11px] text-stone-400">/{category.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="outline">Inactiva</Badge>
                  <button
                    type="button"
                    className={buttonStyles('secondary', 'sm')}
                    onClick={() => void toggle(category.id, true)}
                  >
                    Reactivar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Modal
        open={showCreate}
        title="Nueva categoría propia"
        description="Consume un cupo de tu plan mientras esté activa."
        onClose={() => {
          setShowCreate(false);
          setFormError('');
        }}
        footer={
          <>
            <button
              type="button"
              className={buttonStyles('secondary')}
              onClick={() => setShowCreate(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="create-category-form"
              className={buttonStyles('primary')}
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Crear categoría'}
            </button>
          </>
        }
      >
        <form
          id="create-category-form"
          className="space-y-4"
          onSubmit={(event) => void submit(event)}
        >
          {formError ? <Banner tone="error" message={formError} /> : null}
          <Field
            id="category-name"
            label="Nombre"
            hint="Entre 2 y 60 caracteres. Se usa para el enlace público."
          >
            <input
              id="category-name"
              className={inputStyles}
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={60}
              required
              autoFocus
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
