'use client';

import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import { Modal } from '../../../src/components/modal';
import { Banner, Field, buttonStyles, inputStyles } from '../../../src/components/taxonomy-ui';
import type { AdminSubscriptionRow } from '../../../src/lib/subscription';
import { STATUS_LABELS, formatCop } from '../../../src/lib/subscription';
import { formatDate, type Plan } from '../../../src/lib/business';

/**
 * Formularios de activación manual y ajuste de prueba.
 *
 * El estado de los campos vive en cada componente: escribir en la nota no debe
 * re-renderizar la tabla de suscripciones del padre.
 */

export interface ActivationRequest {
  planId: string;
  note: string;
  idempotencyKey: string;
}

export interface FormOutcome {
  error: string | null;
  locked?: boolean;
}

export function ActivationFormModal({
  row,
  payablePlans,
  idempotencyKey,
  onClose,
  onActivate,
}: {
  row: AdminSubscriptionRow;
  payablePlans: Plan[];
  idempotencyKey: string;
  onClose: () => void;
  onActivate: (request: ActivationRequest) => Promise<FormOutcome>;
}): ReactElement {
  const [planId, setPlanId] = useState(
    () => payablePlans.find((plan) => plan.code !== row.plan.code)?.id ?? payablePlans[0]?.id ?? '',
  );
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  const disabled = busy || locked;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (locked) return;

    if (!planId) {
      setError('Selecciona un plan.');
      return;
    }
    if (note.trim().length === 0) {
      setError('La nota de verificación del pago es obligatoria.');
      return;
    }
    if (!confirmed) {
      setError('Debes confirmar que verificaste el pago por fuera de la plataforma.');
      return;
    }

    setBusy(true);
    setError(null);
    const outcome = await onActivate({ planId, note: note.trim(), idempotencyKey });
    setBusy(false);
    if (outcome.error) setError(outcome.error);
    if (outcome.locked) setLocked(true);
  }

  return (
    <Modal
      open
      title={`Activar plan · ${row.businessName}`}
      description="El pago se recibe y verifica por fuera de la plataforma. Esta acción solo registra la activación."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={buttonStyles('ghost', 'md')}
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="activate-subscription-form"
            className={buttonStyles('primary', 'md')}
            disabled={disabled}
          >
            {busy ? 'Registrando…' : 'Confirmar activación'}
          </button>
        </div>
      }
    >
      <form
        id="activate-subscription-form"
        onSubmit={submit}
        className="space-y-4"
        aria-describedby="activation-lock-note"
      >
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
          <p className="font-medium text-stone-800">
            Plan actual: {row.plan.name} · {STATUS_LABELS[row.status]}
          </p>
          <p className="mt-1 text-stone-600">
            Periodo hasta {formatDate(row.currentPeriodEnd)} · {row.remainingDays} día(s) restantes.
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {row.status === 'ACTIVE' && !row.isExpired
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
            disabled={disabled}
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
            disabled={disabled}
            placeholder="Ej.: Transferencia verificada el 17/11/2026, referencia interna 12345."
          />
        </Field>

        <label className="flex items-start gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            disabled={disabled}
            className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-700 focus:ring-brand-700"
          />
          <span>Confirmo que verifiqué el pago por fuera de la plataforma.</span>
        </label>

        {error ? <Banner tone="error" message={error} /> : null}
        <p id="activation-lock-note" className="sr-only">
          {locked
            ? 'Esta activación ya fue registrada con otra nota y el formulario está bloqueado.'
            : ''}
        </p>
      </form>
    </Modal>
  );
}

export interface TrialRequest {
  days: number;
  note: string;
}

export function TrialFormModal({
  row,
  onClose,
  onAdjust,
}: {
  row: AdminSubscriptionRow;
  onClose: () => void;
  onAdjust: (request: TrialRequest) => Promise<FormOutcome>;
}): ReactElement {
  const [days, setDays] = useState(5);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (note.trim().length === 0) {
      setError('El motivo es obligatorio.');
      return;
    }

    setBusy(true);
    setError(null);
    const outcome = await onAdjust({ days, note: note.trim() });
    setBusy(false);
    if (outcome.error) setError(outcome.error);
  }

  return (
    <Modal
      open
      title={`Ajustar prueba · ${row.businessName}`}
      description="Recorta la prueba a 5, 15 o 20 días, o revócala. Solo aplica a suscripciones en prueba y queda registrado en el historial."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonStyles('ghost', 'md')}>
            Cancelar
          </button>
          <button
            type="submit"
            form="trial-form"
            disabled={busy}
            className={buttonStyles('primary', 'md')}
          >
            {busy ? 'Ajustando…' : 'Ajustar prueba'}
          </button>
        </div>
      }
    >
      <form id="trial-form" onSubmit={submit} className="space-y-4">
        <Field
          id="trial-days"
          label="Días restantes desde hoy"
          hint="0 revoca la prueba y deja la suscripción vencida."
        >
          <select
            id="trial-days"
            className={inputStyles}
            value={String(days)}
            onChange={(event) => setDays(Number(event.target.value))}
            disabled={busy}
          >
            <option value="5">5 días</option>
            <option value="15">15 días</option>
            <option value="20">20 días</option>
            <option value="0">Revocar prueba (0 días)</option>
          </select>
        </Field>

        <Field
          id="trial-note"
          label="Motivo"
          hint="Queda en el historial inmutable de la suscripción."
        >
          <textarea
            id="trial-note"
            required
            maxLength={500}
            rows={3}
            className={inputStyles}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={busy}
            placeholder="Ej.: el negocio pidió más tiempo para terminar de cargar su inventario."
          />
        </Field>

        {error ? <Banner tone="error" message={error} /> : null}
      </form>
    </Modal>
  );
}
