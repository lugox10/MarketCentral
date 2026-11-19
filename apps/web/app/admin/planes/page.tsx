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
import {
  Badge,
  Banner,
  EmptyState,
  SkeletonList,
  buttonStyles,
} from '../../../src/components/taxonomy-ui';
import { PlanFormModal } from './plan-form';

/** Panel de planes: precios, cupos, prueba y disponibilidad (palanca del SUPER_ADMIN). */
export default function AdminPlansPage(): React.ReactElement {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);

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

  const totalSlots = useMemo(() => plans.reduce((sum, plan) => sum + plan.maxListings, 0), [plans]);

  function openEditor(plan: Plan): void {
    setEditing(plan);
  }

  function closeEditor(): void {
    setEditing(null);
  }

  async function handleSavePlan(body: UpdatePlanBody): Promise<string | null> {
    if (!editing) return null;

    try {
      await updatePlan(editing.id, body);
      setNotice(`Plan ${editing.name} actualizado.`);
      closeEditor();
      await load();
      return null;
    } catch (cause: unknown) {
      if (cause instanceof ApiError) {
        return cause.status === 403
          ? 'No tienes permisos para editar planes.'
          : cause.status === 404
            ? 'El plan ya no existe.'
            : cause.message;
      }
      return 'No se pudo actualizar el plan.';
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
      setError(cause instanceof ApiError ? cause.message : 'No se pudo cambiar la disponibilidad.');
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
        <button
          type="button"
          onClick={() => void load()}
          className={buttonStyles('secondary', 'sm')}
        >
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
          {
            label: 'Activos',
            value: plans.filter((plan) => plan.isActive).length,
            hint: 'Asignables',
          },
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

      {editing ? (
        <PlanFormModal plan={editing} onClose={closeEditor} onSave={handleSavePlan} />
      ) : null}
    </div>
  );
}
