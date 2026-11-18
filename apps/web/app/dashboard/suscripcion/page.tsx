'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '../../../src/lib/api';
import type { Plan } from '../../../src/lib/business';
import {
  ACTIVATION_LABELS,
  PLAN_ORDER,
  STATUS_LABELS,
  fetchMySubscription,
  fetchPlans,
  formatCop,
  planPeriodLabel,
  type Subscription,
  type SubscriptionStatus,
} from '../../../src/lib/subscription';
import {
  Badge,
  Banner,
  EmptyState,
  SkeletonList,
  StatCard,
  buttonStyles,
  cx,
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

function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export default function SubscriptionPanelPage(): React.ReactElement {
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const [mine, catalogue] = await Promise.all([fetchMySubscription(), fetchPlans()]);
      setSubscription(mine);
      setPlans(catalogue);
      setError(null);
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace('/login');
        return;
      }
      if (cause instanceof ApiError && cause.status === 404) {
        setError(
          'Tu negocio todavía no tiene una suscripción registrada. Contacta a administración para regularizarla.',
        );
        return;
      }
      setError('No se pudo cargar la suscripción. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <SkeletonList rows={4} />
      </main>
    );
  }

  if (error && !subscription) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState
          title="Sin suscripción disponible"
          description={error}
          action={
            <Link href="/dashboard" className={buttonStyles('secondary', 'sm')}>
              Volver al panel
            </Link>
          }
        />
      </main>
    );
  }

  if (!subscription) return <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6" />;

  const status = subscription.status;
  const expiringSoon =
    (status === 'TRIALING' || status === 'ACTIVE') && subscription.remainingDays <= 7;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <nav aria-label="Ruta de navegación" className="text-xs text-stone-500">
        <Link href="/dashboard" className="hover:text-stone-800">
          Panel
        </Link>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <span className="text-stone-700">Suscripción</span>
      </nav>

      <header className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            Plan y suscripción
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {subscription.business.name} · los pagos se verifican y activan manualmente por
            administración.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/negocio" className={buttonStyles('secondary', 'sm')}>
            Datos del negocio
          </Link>
          <button
            type="button"
            onClick={() => {
              setNotice('Estado actualizado.');
              void load();
            }}
            className={buttonStyles('primary', 'sm')}
          >
            Actualizar
          </button>
        </div>
      </header>

      {notice ? (
        <div className="mt-5">
          <Banner tone="success" message={notice} onDismiss={() => setNotice(null)} />
        </div>
      ) : null}

      {status === 'EXPIRED' ? (
        <div className="mt-5">
          <Banner
            tone="error"
            message="El periodo de tu suscripción terminó. El catálogo público y la publicación de artículos quedan limitados: contacta a administración para verificar un pago y reactivar el plan."
          />
        </div>
      ) : null}

      {status === 'TRIALING' ? (
        <div className="mt-5">
          <Banner
            tone={expiringSoon ? 'error' : 'info'}
            message={
              expiringSoon
                ? `Tu prueba Free vence en ${subscription.remainingDays} día(s). Contacta a administración para activar Base o Pro.`
                : `Estás en el Plan Free: una prueba de ${subscription.plan.trialMonths} meses. Al vencer, el negocio pasa a vencido hasta que administración active un plan pagado.`
            }
          />
        </div>
      ) : null}

      {status === 'ACTIVE' && expiringSoon ? (
        <div className="mt-5">
          <Banner
            tone="error"
            message={`Tu plan vence en ${subscription.remainingDays} día(s). Coordina la renovación con administración para no perder el servicio.`}
          />
        </div>
      ) : null}

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Plan actual"
          value={subscription.plan.name}
          hint={`Código ${subscription.plan.code}`}
        />
        <StatCard
          label="Estado"
          value={STATUS_LABELS[status]}
          hint={subscription.isExpired ? 'Periodo vencido' : 'Periodo vigente'}
        />
        <StatCard
          label="Días restantes"
          value={String(subscription.remainingDays)}
          hint={`Vence el ${formatLongDate(subscription.currentPeriodEnd)}`}
        />
        <StatCard
          label="Límite de publicaciones"
          value={String(subscription.plan.maxListings)}
          hint="Aplica al crear publicaciones (E5)"
        />
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-stone-900">Periodo actual</h2>
            <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">Inicio</dt>
              <dd className="mt-1 text-stone-800">
                {formatLongDate(subscription.currentPeriodStart)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">
                Vencimiento
              </dt>
              <dd className="mt-1 text-stone-800">
                {formatLongDate(subscription.currentPeriodEnd)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">Precio</dt>
              <dd className="mt-1 text-stone-800">
                {subscription.plan.priceCop === 0
                  ? 'Gratis (prueba)'
                  : `${formatCop(subscription.plan.priceCop)} · ${planPeriodLabel(subscription.plan)}`}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">Moneda</dt>
              <dd className="mt-1 text-stone-800">{subscription.plan.currency}</dd>
            </div>
          </dl>

          {subscription.lastActivation ? (
            <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
              <p className="font-medium text-stone-800">
                Última {ACTIVATION_LABELS[subscription.lastActivation.kind].toLowerCase()}
              </p>
              <p className="mt-1 text-stone-600">
                {formatDateTime(subscription.lastActivation.activatedAt)}
                {subscription.lastActivation.adminName
                  ? ` · verificada por ${subscription.lastActivation.adminName}`
                  : ''}
              </p>
              <p className="mt-1 text-stone-600">Nota: {subscription.lastActivation.note}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-stone-600">
              Sin activaciones manuales registradas: esta suscripción se creó automáticamente al
              registrar el negocio.
            </p>
          )}
        </div>

        <aside className="rounded-xl border border-brand-100 bg-brand-50/60 p-5">
          <h2 className="text-base font-semibold text-brand-900">Cómo se activa un plan</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-stone-700">
            <li>Acuerdas el pago con administración por fuera de la plataforma.</li>
            <li>Administración verifica el pago recibido.</li>
            <li>Un administrador registra la activación o renovación aquí mismo.</li>
            <li>El periodo se extiende 30 días y recibes la confirmación en tu panel.</li>
          </ol>
          <p className="mt-3 text-xs text-stone-600">
            No existe cobro automático ni checkout en la plataforma: los artículos se pagan siempre
            entre comprador y negocio, por fuera de MarketCentral.
          </p>
        </aside>
      </section>

      <section className="mt-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Planes disponibles</h2>
            <p className="text-sm text-stone-600">
              Precios en pesos colombianos. Base y Pro se cobran por 30 días de servicio.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[...plans]
            .sort(
              (a, b) =>
                PLAN_ORDER.indexOf(a.code as (typeof PLAN_ORDER)[number]) -
                PLAN_ORDER.indexOf(b.code as (typeof PLAN_ORDER)[number]),
            )
            .map((plan) => {
              const current = plan.id === subscription.plan.id;
              return (
                <article
                  key={plan.id}
                  className={cx(
                    'rounded-xl border bg-white p-5 shadow-sm transition',
                    current ? 'border-brand-700 ring-1 ring-brand-700/20' : 'border-stone-200',
                  )}
                  aria-current={current ? 'true' : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-stone-900">{plan.name}</h3>
                    {current ? <Badge tone="brand">Plan actual</Badge> : null}
                  </div>

                  <p className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
                    {plan.priceCop === 0 ? 'Gratis' : formatCop(plan.priceCop)}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {plan.billingPeriodDays
                      ? `por ${plan.billingPeriodDays} días`
                      : plan.trialMonths > 0
                        ? `prueba de ${plan.trialMonths} meses`
                        : '—'}
                  </p>

                  <ul className="mt-4 space-y-2 text-sm text-stone-700">
                    <li>{plan.maxListings} publicaciones activas</li>
                    <li>
                      {plan.trialMonths > 0
                        ? 'Prueba inicial; al vencer pasa a vencida'
                        : 'Requiere activación manual de administración'}
                    </li>
                    <li>Contacto por WhatsApp y formulario incluidos</li>
                  </ul>
                </article>
              );
            })}
        </div>
      </section>
    </main>
  );
}
