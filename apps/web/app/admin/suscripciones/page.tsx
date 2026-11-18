'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import { ApiError } from '../../../src/lib/api';
import {
  ACTIVATION_LABELS,
  STATUS_LABELS,
  activateSubscription,
  fetchAdminSubscriptions,
  fetchPlans,
  formatCop,
  newIdempotencyKey,
  type AdminSubscriptionPage,
  type AdminSubscriptionRow,
  type SubscriptionStatus,
} from '../../../src/lib/subscription';
import type { Plan } from '../../../src/lib/business';
import { Modal } from '../../../src/components/modal';
import {
  Badge,
  Banner,
  EmptyState,
  Field,
  SearchField,
  SkeletonList,
  StatCard,
  buttonStyles,
  cx,
  inputStyles,
} from '../../../src/components/taxonomy-ui';

const STATUS_TONE: Record<
  SubscriptionStatus,
  'brand' | 'success' | 'warning' | 'danger' | 'neutral'
> = {
  TRIALING: 'brand',
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  EXPIRED: 'danger',
  CANCELLED: 'neutral',
};

const FILTERABLE_STATUS: SubscriptionStatus[] = ['TRIALING', 'ACTIVE', 'EXPIRED'];
const PAGE_SIZE = 10;

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function describeError(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    if (cause.status === 403) return 'No tienes permisos de administración para esta acción.';
    if (cause.status === 404) return 'El negocio, el plan o la suscripción ya no existe.';
    if (cause.status === 409) {
      return 'La operación ya se registró con otros datos. Cierra el formulario y revisa el periodo actual antes de reintentar.';
    }
    return cause.message;
  }
  return 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
}

export default function AdminSubscriptionsPage(): React.ReactElement {
  const router = useRouter();

  const [data, setData] = useState<AdminSubscriptionPage | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [status, setStatus] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const [target, setTarget] = useState<AdminSubscriptionRow | null>(null);
  const [planId, setPlanId] = useState('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalLocked, setModalLocked] = useState(false);

  const payablePlans = useMemo(
    () => plans.filter((plan) => plan.code === 'BASE' || plan.code === 'PRO'),
    [plans],
  );

  const load = useCallback(async (): Promise<void> => {
    try {
      const [list, catalogue] = await Promise.all([
        fetchAdminSubscriptions({ page, limit: PAGE_SIZE, status, plan: planFilter, q: query }),
        fetchPlans(),
      ]);
      setData(list);
      setPlans(catalogue);
      setError(null);
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace('/login');
        return;
      }
      if (cause instanceof ApiError && cause.status === 403) {
        setError('Esta sección es exclusiva de administración de la plataforma.');
        return;
      }
      setError(describeError(cause));
    } finally {
      setLoading(false);
    }
  }, [page, status, planFilter, query, router]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load, reloadToken]);

  function openModal(row: AdminSubscriptionRow): void {
    setTarget(row);
    setPlanId(row.plan.code === 'BASE' ? 'PRO' : (payablePlans[0]?.id ?? ''));
    setNote('');
    setConfirmed(false);
    setModalError(null);
    setModalLocked(false);
    setIdempotencyKey(newIdempotencyKey('activate'));
  }

  function closeModal(): void {
    if (submitting) return;
    setTarget(null);
  }

  async function submitActivation(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!target || !planId || submitting || modalLocked) return;

    const trimmed = note.trim();
    if (trimmed.length === 0) {
      setModalError('La nota de verificación del pago es obligatoria.');
      return;
    }
    if (!confirmed) {
      setModalError('Debes confirmar que verificaste el pago por fuera de la plataforma.');
      return;
    }

    setSubmitting(true);
    setModalError(null);
    try {
      const result = await activateSubscription(
        target.businessId,
        { planId, note: trimmed },
        idempotencyKey,
      );
      const action = result.replayed ? 'ya estaba registrada' : 'registrada';
      setNotice(
        `Activación ${action}: ${result.subscription.business.name} quedó en ${result.subscription.plan.name} con vencimiento ${formatDate(result.subscription.currentPeriodEnd)}.`,
      );
      setTarget(null);
      setLoading(true);
      setReloadToken((value) => value + 1);
    } catch (cause: unknown) {
      setModalError(describeError(cause));
      if (cause instanceof ApiError && cause.status === 409) setModalLocked(true);
      if (cause instanceof ApiError && cause.status === 401) router.replace('/login');
    } finally {
      setSubmitting(false);
    }
  }

  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav aria-label="Ruta de navegación" className="text-xs text-stone-500">
        <Link href="/dashboard" className="hover:text-stone-800">
          Administración
        </Link>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <span className="text-stone-700">Suscripciones</span>
      </nav>

      <header className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            Suscripciones
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Verifica el pago por fuera de la plataforma y registra la activación manualmente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/negocios" className={buttonStyles('secondary', 'sm')}>
            Negocios
          </Link>
          <Link href="/admin/taxonomia" className={buttonStyles('secondary', 'sm')}>
            Taxonomía
          </Link>
        </div>
      </header>

      {notice ? (
        <div className="mt-5">
          <Banner tone="success" message={notice} onDismiss={() => setNotice(null)} />
        </div>
      ) : null}

      {error ? (
        <div className="mt-5">
          <Banner tone="error" message={error} />
        </div>
      ) : null}

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Suscripciones" value={String(data?.total ?? 0)} hint="Según los filtros" />
        <StatCard
          label="En esta página"
          value={String(items.length)}
          hint={`Página ${data?.page ?? 1} de ${data?.totalPages ?? 1}`}
        />
        <StatCard
          label="Planes pagados"
          value={String(items.filter((item) => item.status === 'ACTIVE').length)}
          hint="ACTIVE en esta página"
        />
        <StatCard
          label="Vencidas"
          value={String(items.filter((item) => item.status === 'EXPIRED').length)}
          hint="EXPIRED en esta página"
        />
      </section>

      <section className="mt-6 rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 lg:flex-row lg:items-end lg:justify-between">
          <form
            className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setLoading(true);
              setQuery(searchInput);
            }}
          >
            <div className="min-w-0 flex-1">
              <SearchField
                id="subscription-search"
                label="Buscar por negocio"
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Nombre del negocio"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className={buttonStyles('primary', 'sm')}>
                Buscar
              </button>
              <button
                type="button"
                className={buttonStyles('ghost', 'sm')}
                onClick={() => {
                  setSearchInput('');
                  setLoading(true);
                  setQuery('');
                  setStatus('');
                  setPlanFilter('');
                  setPage(1);
                }}
              >
                Limpiar
              </button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2">
            <label className="text-xs font-medium text-stone-600">
              <span className="mb-1 block">Estado</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setLoading(true);
                  setPage(1);
                }}
                className={cx(inputStyles, 'w-40')}
              >
                <option value="">Todos</option>
                {FILTERABLE_STATUS.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-medium text-stone-600">
              <span className="mb-1 block">Plan</span>
              <select
                value={planFilter}
                onChange={(event) => {
                  setPlanFilter(event.target.value);
                  setLoading(true);
                  setPage(1);
                }}
                className={cx(inputStyles, 'w-40')}
              >
                <option value="">Todos</option>
                <option value="FREE">Free</option>
                <option value="BASE">Base</option>
                <option value="PRO">Pro</option>
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="p-4">
            <SkeletonList rows={5} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Sin suscripciones que coincidan"
              description="Ajusta los filtros o limpia la búsqueda para ver todos los negocios."
            />
          </div>
        ) : (
          <>
            {/* Escritorio: tabla */}
            <div className="hidden lg:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Negocio
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Plan
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Estado
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Inicio
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Vence
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Días
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Última activación
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-900">{row.businessName}</p>
                        <p className="text-xs text-stone-500">{row.business.id.slice(0, 8)}…</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-stone-800">{row.plan.name}</span>
                        <span className="ml-2 text-xs text-stone-500">
                          {row.plan.priceCop === 0 ? 'Gratis' : formatCop(row.plan.priceCop)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-stone-700">
                        {formatDate(row.currentPeriodStart)}
                      </td>
                      <td className="px-4 py-3 text-stone-700">
                        {formatDate(row.currentPeriodEnd)}
                      </td>
                      <td className="px-4 py-3 text-stone-700">{row.remainingDays}</td>
                      <td className="px-4 py-3 text-xs text-stone-600">
                        {row.lastActivation ? (
                          <>
                            <p>
                              {ACTIVATION_LABELS[row.lastActivation.kind]} ·{' '}
                              {formatDateTime(row.lastActivation.activatedAt)}
                            </p>
                            <p className="text-stone-500">
                              {row.lastActivation.adminName ?? 'Administrador eliminado'}
                            </p>
                          </>
                        ) : (
                          <span className="text-stone-400">Alta automática</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openModal(row)}
                          className={buttonStyles('secondary', 'sm')}
                        >
                          {row.status === 'ACTIVE' ? 'Renovar plan' : 'Activar plan'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Móvil/tablet: tarjetas para evitar desbordamiento */}
            <ul className="divide-y divide-stone-100 lg:hidden">
              {items.map((row) => (
                <li key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-stone-900">{row.businessName}</p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {row.plan.name} ·{' '}
                        {row.plan.priceCop === 0 ? 'Gratis' : formatCop(row.plan.priceCop)}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-stone-600">
                    <div>
                      <dt className="font-medium text-stone-700">Inicio</dt>
                      <dd>{formatDate(row.currentPeriodStart)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-stone-700">Vence</dt>
                      <dd>{formatDate(row.currentPeriodEnd)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-stone-700">Días restantes</dt>
                      <dd>{row.remainingDays}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="font-medium text-stone-700">Última activación</dt>
                      <dd className="truncate">
                        {row.lastActivation
                          ? `${ACTIVATION_LABELS[row.lastActivation.kind]} · ${formatDate(row.lastActivation.activatedAt)}`
                          : 'Alta automática'}
                      </dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    onClick={() => openModal(row)}
                    className={cx(buttonStyles('secondary', 'sm'), 'mt-3 w-full')}
                  >
                    {row.status === 'ACTIVE' ? 'Renovar plan' : 'Activar plan'}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex flex-col gap-3 border-t border-stone-200 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-stone-600">
            {data
              ? `${data.total} suscripción(es) · página ${data.page} de ${data.totalPages}`
              : '—'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={buttonStyles('secondary', 'sm')}
              disabled={!data || data.page <= 1 || loading}
              onClick={() => {
                setLoading(true);
                setPage((value) => Math.max(1, value - 1));
              }}
            >
              Anterior
            </button>
            <button
              type="button"
              className={buttonStyles('secondary', 'sm')}
              disabled={!data || data.page >= data.totalPages || loading}
              onClick={() => {
                setLoading(true);
                setPage((value) => value + 1);
              }}
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      <Modal
        open={target !== null}
        title={target ? `Activar plan · ${target.businessName}` : 'Activar plan'}
        description="El pago se recibe y verifica por fuera de la plataforma. Esta acción solo registra la activación."
        onClose={closeModal}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={buttonStyles('ghost', 'md')}
              onClick={closeModal}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="activate-subscription-form"
              className={buttonStyles('primary', 'md')}
              disabled={submitting || modalLocked}
            >
              {submitting ? 'Registrando…' : 'Confirmar activación'}
            </button>
          </div>
        }
      >
        {target ? (
          <form
            id="activate-subscription-form"
            onSubmit={(event) => void submitActivation(event)}
            className="space-y-4"
          >
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
              <p className="font-medium text-stone-800">
                Plan actual: {target.plan.name} · {STATUS_LABELS[target.status]}
              </p>
              <p className="mt-1 text-stone-600">
                Periodo hasta {formatDate(target.currentPeriodEnd)} · {target.remainingDays} día(s)
                restantes.
              </p>
              <p className="mt-1 text-xs text-stone-500">
                {target.status === 'ACTIVE' && !target.isExpired
                  ? 'La activación conserva los días vigentes y agrega 30.'
                  : 'El nuevo periodo pagado comienza ahora y dura 30 días.'}
              </p>
            </div>

            <Field
              id="activation-plan"
              label="Plan a activar"
              hint="Solo Base o Pro; Free es la prueba inicial."
            >
              <select
                id="activation-plan"
                className={inputStyles}
                value={planId}
                onChange={(event) => setPlanId(event.target.value)}
                disabled={submitting || modalLocked}
              >
                {payablePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · {formatCop(plan.priceCop)} · {plan.maxListings} publicaciones
                  </option>
                ))}
              </select>
            </Field>

            <Field
              id="activation-note"
              label="Nota de verificación del pago"
              hint="Describe la referencia interna o el medio de pago. No incluyas datos de tarjetas ni claves."
            >
              <textarea
                id="activation-note"
                required
                maxLength={500}
                rows={3}
                className={inputStyles}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                disabled={submitting || modalLocked}
                placeholder="Ej.: Transferencia verificada el 17/11/2026, referencia interna 12345."
              />
            </Field>

            <label className="flex items-start gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={submitting || modalLocked}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-700 focus:ring-brand-700"
              />
              <span>Confirmo que verifiqué el pago por fuera de la plataforma.</span>
            </label>

            {modalError ? <Banner tone="error" message={modalError} /> : null}
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
