'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, getJson } from '../../../src/lib/api';
import type { Plan } from '../../../src/lib/business';
import {
  fetchAdminPlans,
  formatCop,
  planPeriodLabel,
  updatePlan,
  type UpdatePlanBody,
} from '../../../src/lib/subscription';
import { Modal } from '../../../src/components/modal';
import {
  Badge,
  Banner,
  EmptyState,
  Field,
  SkeletonList,
  buttonStyles,
  inputStyles,
} from '../../../src/components/taxonomy-ui';

interface FormState {
  priceCop: string;
  maxListings: string;
  maxCategories: string;
  featuredSlots: string;
  trialMonths: string;
  trialDays: string;
  billingPeriodDays: string;
}

function toForm(plan: Plan): FormState {
  return {
    priceCop: String(plan.priceCop),
    maxListings: String(plan.maxListings),
    maxCategories: String(plan.maxCategories),
    featuredSlots: String(plan.featuredSlots),
    trialMonths: String(plan.trialMonths),
    trialDays: plan.trialDays === null ? '' : String(plan.trialDays),
    billingPeriodDays: plan.billingPeriodDays === null ? '' : String(plan.billingPeriodDays),
  };
}

function parseNumber(value: string, label: string, allowEmpty = false): number | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    if (allowEmpty) return null;
    throw new Error(`${label} es obligatorio.`);
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} debe ser un entero mayor o igual a 0.`);
  }
  return parsed;
}

/** Panel de planes: precios, cupos, prueba y disponibilidad (palanca del SUPER_ADMIN). */
export default function AdminPlansPage(): React.ReactElement {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const me = await getJson<{ role: string }>('/auth/me');
      if (me.role !== 'SUPER_ADMIN') {
        setError('Solo un administrador de plataforma puede editar los planes.');
        setPlans([]);
        return;
      }
      setPlans(await fetchAdminPlans());
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace('/login');
        return;
      }
      setError(
        cause instanceof ApiError && cause.status === 403
          ? 'No tienes permisos para ver los planes.'
          : 'No se pudieron cargar los planes.',
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const totalSlots = useMemo(
    () => plans.reduce((sum, plan) => sum + plan.maxListings, 0),
    [plans],
  );

  function openEditor(plan: Plan): void {
    setEditing(plan);
    setForm(toForm(plan));
    setModalError(null);
  }

  function closeEditor(): void {
    setEditing(null);
    setForm(null);
    setModalError(null);
  }

  async function save(): Promise<void> {
    if (!editing || !form) return;
    setModalError(null);
    setSaving(true);
    try {
      const body: UpdatePlanBody = {
        priceCop: parseNumber(form.priceCop, 'Precio') ?? 0,
        maxListings: parseNumber(form.maxListings, 'Publicaciones') ?? 0,
        maxCategories: parseNumber(form.maxCategories, 'Categorías') ?? 0,
        featuredSlots: parseNumber(form.featuredSlots, 'Destacados') ?? 0,
        trialMonths: parseNumber(form.trialMonths, 'Prueba en meses') ?? 0,
        trialDays: parseNumber(form.trialDays, 'Prueba en días', true),
        billingPeriodDays: parseNumber(form.billingPeriodDays, 'Periodo en días', true),
      };
      await updatePlan(editing.id, body);
      setNotice(`Plan ${editing.name} actualizado.`);
      closeEditor();
      await load();
    } catch (cause: unknown) {
      if (cause instanceof Error && !(cause instanceof ApiError)) {
        setModalError(cause.message);
        return;
      }
      if (cause instanceof ApiError) {
        setModalError(
          cause.status === 403
            ? 'No tienes permisos para editar planes.'
            : cause.status === 404
              ? 'El plan ya no existe.'
              : cause.message,
        );
        return;
      }
      setModalError('No se pudo actualizar el plan.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(plan: Plan): Promise<void> {
    setError(null);
    try {
      await updatePlan(plan.id, { isActive: !plan.isActive });
      setNotice(
        plan.isActive
          ? `Plan ${plan.name} desactivado: no se podrá asignar a negocios nuevos.`
          : `Plan ${plan.name} activado.`,
      );
      await load();
    } catch (cause: unknown) {
      setError(
        cause instanceof ApiError ? cause.message : 'No se pudo cambiar la disponibilidad.',
      );
    }
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Ruta de navegación" className="text-xs text-stone-500">
        Administración / Planes
      </nav>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Planes</h1>
          <p className="mt-1 text-sm text-stone-600">
            Precio, cupos y prueba de cada plan. Desactivar Free cierra las altas nuevas.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className={buttonStyles('secondary', 'sm')}>
          Actualizar
        </button>
      </div>

      {notice ? (
        <div className="mt-4">
          <Banner tone="success" message={notice} onDismiss={() => setNotice(null)} />
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <Banner tone="error" message={error} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Planes', value: plans.length, hint: 'Incluye inactivos' },
          { label: 'Publicaciones', value: totalSlots, hint: 'Suma de cupos' },
          { label: 'Activos', value: plans.filter((plan) => plan.isActive).length, hint: 'Asignables' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-stone-500">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold text-stone-900">{item.value}</p>
            <p className="text-xs text-stone-500">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-stone-200 bg-white">
        {loading ? (
          <div className="p-4">
            <SkeletonList rows={3} />
          </div>
        ) : plans.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Sin planes cargados"
              description="Ejecuta el seed o crea los planes desde la base de datos."
            />
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {plans.map((plan) => (
              <li key={plan.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-stone-900">{plan.name}</span>
                    <Badge tone={plan.isActive ? 'success' : 'warning'}>
                      {plan.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <Badge tone="outline" mono>
                      {plan.code}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-stone-600">
                    {formatCop(plan.priceCop)} · {plan.maxListings} publicaciones ·{' '}
                    {plan.maxCategories} categorías propias · {plan.featuredSlots} destacados ·{' '}
                    {planPeriodLabel(plan)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEditor(plan)}
                    className={buttonStyles('secondary', 'sm')}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleActive(plan)}
                    className={buttonStyles('ghost', 'sm')}
                  >
                    {plan.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={editing !== null}
        title={editing ? `Editar plan ${editing.name}` : 'Editar plan'}
        description="Los cambios aplican a futuras asignaciones; las suscripciones vigentes conservan su periodo."
        onClose={closeEditor}
        footer={
          <>
            <button type="button" onClick={closeEditor} className={buttonStyles('secondary')}>
              Cancelar
            </button>
            <button
              type="submit"
              form="plan-form"
              disabled={saving}
              className={buttonStyles('primary')}
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </>
        }
      >
        {form ? (
          <form
            id="plan-form"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            className="space-y-4"
          >
            {modalError ? <Banner tone="error" message={modalError} /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="priceCop" label="Precio (COP)">
                <input
                  id="priceCop"
                  className={inputStyles}
                  inputMode="numeric"
                  value={form.priceCop}
                  onChange={(event) => setForm({ ...form, priceCop: event.target.value })}
                />
              </Field>
              <Field id="maxListings" label="Publicaciones incluidas">
                <input
                  id="maxListings"
                  className={inputStyles}
                  inputMode="numeric"
                  value={form.maxListings}
                  onChange={(event) => setForm({ ...form, maxListings: event.target.value })}
                />
              </Field>
              <Field id="maxCategories" label="Categorías propias">
                <input
                  id="maxCategories"
                  className={inputStyles}
                  inputMode="numeric"
                  value={form.maxCategories}
                  onChange={(event) => setForm({ ...form, maxCategories: event.target.value })}
                />
              </Field>
              <Field id="featuredSlots" label="Destacados simultáneos">
                <input
                  id="featuredSlots"
                  className={inputStyles}
                  inputMode="numeric"
                  value={form.featuredSlots}
                  onChange={(event) => setForm({ ...form, featuredSlots: event.target.value })}
                />
              </Field>
              <Field id="trialMonths" label="Prueba (meses)">
                <input
                  id="trialMonths"
                  className={inputStyles}
                  inputMode="numeric"
                  value={form.trialMonths}
                  onChange={(event) => setForm({ ...form, trialMonths: event.target.value })}
                />
              </Field>
              <Field id="trialDays" label="Prueba (días)" hint="Si se define, sustituye a los meses.">
                <input
                  id="trialDays"
                  className={inputStyles}
                  inputMode="numeric"
                  placeholder="Vacío"
                  value={form.trialDays}
                  onChange={(event) => setForm({ ...form, trialDays: event.target.value })}
                />
              </Field>
              <Field id="billingPeriodDays" label="Periodo pagado (días)">
                <input
                  id="billingPeriodDays"
                  className={inputStyles}
                  inputMode="numeric"
                  placeholder="Vacío"
                  value={form.billingPeriodDays}
                  onChange={(event) =>
                    setForm({ ...form, billingPeriodDays: event.target.value })
                  }
                />
              </Field>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
