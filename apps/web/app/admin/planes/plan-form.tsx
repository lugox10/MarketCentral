'use client';

import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import { Modal } from '../../../src/components/modal';
import { Banner, Field, buttonStyles, inputStyles } from '../../../src/components/taxonomy-ui';
import type { Plan } from '../../../src/lib/business';
import type { UpdatePlanBody } from '../../../src/lib/subscription';

/**
 * Editor de un plan. El estado de los campos vive aquí para que escribir no
 * vuelva a renderizar la lista de planes ni las tarjetas de la página.
 */

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

export function PlanFormModal({
  plan,
  onClose,
  onSave,
}: {
  plan: Plan;
  onClose: () => void;
  onSave: (body: UpdatePlanBody) => Promise<string | null>;
}): ReactElement {
  const [form, setForm] = useState<FormState>(() => toForm(plan));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function patch(next: Partial<FormState>): void {
    setForm((current) => ({ ...current, ...next }));
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    let body: UpdatePlanBody;
    try {
      body = {
        priceCop: parseNumber(form.priceCop, 'Precio') ?? 0,
        maxListings: parseNumber(form.maxListings, 'Publicaciones') ?? 0,
        maxCategories: parseNumber(form.maxCategories, 'Categorías') ?? 0,
        featuredSlots: parseNumber(form.featuredSlots, 'Destacados') ?? 0,
        trialMonths: parseNumber(form.trialMonths, 'Prueba en meses') ?? 0,
        trialDays: parseNumber(form.trialDays, 'Prueba en días', true),
        billingPeriodDays: parseNumber(form.billingPeriodDays, 'Periodo en días', true),
      };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Revisa los valores.');
      return;
    }

    setBusy(true);
    const failure = await onSave(body);
    setBusy(false);
    if (failure) setError(failure);
  }

  return (
    <Modal
      open
      title={`Editar plan ${plan.name}`}
      description="Los cambios aplican a futuras asignaciones; las suscripciones vigentes conservan su periodo."
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonStyles('secondary')}>
            Cancelar
          </button>
          <button
            type="submit"
            form="plan-form"
            disabled={busy}
            className={buttonStyles('primary')}
          >
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      <form id="plan-form" onSubmit={submit} className="space-y-4" noValidate>
        {error ? <Banner tone="error" message={error} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="priceCop" label="Precio (COP)">
            <input
              id="priceCop"
              className={inputStyles}
              inputMode="numeric"
              value={form.priceCop}
              onChange={(event) => patch({ priceCop: event.target.value })}
            />
          </Field>
          <Field id="maxListings" label="Publicaciones incluidas">
            <input
              id="maxListings"
              className={inputStyles}
              inputMode="numeric"
              value={form.maxListings}
              onChange={(event) => patch({ maxListings: event.target.value })}
            />
          </Field>
          <Field id="maxCategories" label="Categorías propias">
            <input
              id="maxCategories"
              className={inputStyles}
              inputMode="numeric"
              value={form.maxCategories}
              onChange={(event) => patch({ maxCategories: event.target.value })}
            />
          </Field>
          <Field id="featuredSlots" label="Destacados simultáneos">
            <input
              id="featuredSlots"
              className={inputStyles}
              inputMode="numeric"
              value={form.featuredSlots}
              onChange={(event) => patch({ featuredSlots: event.target.value })}
            />
          </Field>
          <Field id="trialMonths" label="Prueba (meses)">
            <input
              id="trialMonths"
              className={inputStyles}
              inputMode="numeric"
              value={form.trialMonths}
              onChange={(event) => patch({ trialMonths: event.target.value })}
            />
          </Field>
          <Field id="trialDays" label="Prueba (días)" hint="Si se define, sustituye a los meses.">
            <input
              id="trialDays"
              className={inputStyles}
              inputMode="numeric"
              placeholder="Vacío"
              value={form.trialDays}
              onChange={(event) => patch({ trialDays: event.target.value })}
            />
          </Field>
          <Field id="billingPeriodDays" label="Periodo pagado (días)">
            <input
              id="billingPeriodDays"
              className={inputStyles}
              inputMode="numeric"
              placeholder="Vacío"
              value={form.billingPeriodDays}
              onChange={(event) => patch({ billingPeriodDays: event.target.value })}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
