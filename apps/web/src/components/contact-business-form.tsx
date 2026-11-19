'use client';

import { useEffect, useMemo, useState } from 'react';

import { ApiError } from '../lib/api';
import {
  fetchLeadFormToken,
  leadErrorMessage,
  submitPublicLead,
  type LeadFormToken,
} from '../lib/leads';
import { Modal } from './modal';
import { Banner, buttonStyles, cx, Field, inputStyles } from './taxonomy-ui';

interface ContactBusinessButtonProps {
  businessSlug: string;
  businessName: string;
  listingSlug?: string;
  listingTitle?: string;
  variant?: 'primary' | 'outline';
  label?: string;
}

const EMPTY_FORM = {
  buyerName: '',
  buyerEmail: '',
  buyerPhone: '',
  message: '',
  consent: false,
  website: '',
};

type FormValues = typeof EMPTY_FORM;
type FieldKey = 'buyerName' | 'buyerEmail' | 'buyerPhone' | 'message' | 'consent';

function validate(values: FormValues): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  const name = values.buyerName.trim();
  if (name.length < 2) errors.buyerName = 'Escribe tu nombre.';
  const email = values.buyerEmail.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.buyerEmail = 'Revisa el correo.';
  const phone = values.buyerPhone.replace(/[^\d+]/g, '');
  if (phone.replace(/\D/g, '').length < 10)
    errors.buyerPhone = 'Escribe un teléfono de 10 dígitos.';
  const message = values.message.trim();
  if (message.length < 10)
    errors.message = 'Cuéntale al negocio qué necesitas (mínimo 10 caracteres).';
  if (message.length > 2000) errors.message = 'El mensaje no puede pasar de 2000 caracteres.';
  if (!values.consent) errors.consent = 'Necesitamos tu autorización para compartir tus datos.';
  return errors;
}

function ContactForm({
  businessSlug,
  businessName,
  listingSlug,
  listingTitle,
  onClose,
}: {
  businessSlug: string;
  businessName: string;
  listingSlug?: string;
  listingTitle?: string;
  onClose: () => void;
}): React.ReactElement {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [token, setToken] = useState<LeadFormToken | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchLeadFormToken()
      .then((result) => {
        if (cancelled) return;
        setToken(result);
        setSecondsLeft(result.minSeconds);
      })
      .catch(() => {
        if (!cancelled)
          setTokenError('No pudimos preparar el formulario. Cierra e inténtalo de nuevo.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const readyToSend = token !== null && secondsLeft <= 0;
  const canSubmit = useMemo(() => readyToSend && !sending && !sent, [readyToSend, sending, sent]);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]): void {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (sending) return;
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!token) {
      setFailure('El formulario todavía no está listo. Espera un segundo.');
      return;
    }

    setSending(true);
    setFailure(null);
    try {
      await submitPublicLead({
        businessSlug,
        listingSlug,
        buyerName: values.buyerName.trim(),
        buyerEmail: values.buyerEmail.trim(),
        buyerPhone: values.buyerPhone.trim(),
        message: values.message.trim(),
        consent: values.consent,
        website: values.website,
        formToken: token.token,
      });
      setSent(true);
    } catch (cause: unknown) {
      if (cause instanceof ApiError) {
        setFailure(leadErrorMessage(cause.code, cause.message));
      } else {
        setFailure('No pudimos enviar el mensaje. Revisa tu conexión e inténtalo de nuevo.');
      }
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Modal
        open
        title="Mensaje enviado"
        description={`${businessName} recibió tus datos y podrá contactarte directamente.`}
        onClose={onClose}
        footer={
          <button type="button" onClick={onClose} className={buttonStyles('primary')}>
            Listo
          </button>
        }
      >
        <p className="text-sm text-stone-700">
          Tu mensaje quedó registrado con tu consentimiento. La respuesta y la negociación se hacen
          directamente con el negocio, fuera de MarketCentral.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      title={`Escribir a ${businessName}`}
      description={
        listingTitle
          ? `Sobre «${listingTitle}». Te responderán directamente al correo o al teléfono que dejes.`
          : 'Te responderán directamente al correo o al teléfono que dejes.'
      }
      onClose={onClose}
    >
      <form
        id="contact-form"
        onSubmit={(event) => void submit(event)}
        className="space-y-4"
        noValidate
      >
        {failure ? <Banner tone="error" message={failure} /> : null}
        {tokenError ? <Banner tone="error" message={tokenError} /> : null}

        <Field id="contact-name" label="Tu nombre" error={errors.buyerName}>
          <input
            id="contact-name"
            value={values.buyerName}
            onChange={(event) => update('buyerName', event.target.value)}
            onBlur={() =>
              setErrors((current) => ({ ...current, buyerName: validate(values).buyerName }))
            }
            className={inputStyles}
            autoComplete="name"
            maxLength={100}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="contact-email" label="Correo" error={errors.buyerEmail}>
            <input
              id="contact-email"
              type="email"
              value={values.buyerEmail}
              onChange={(event) => update('buyerEmail', event.target.value)}
              onBlur={() =>
                setErrors((current) => ({ ...current, buyerEmail: validate(values).buyerEmail }))
              }
              className={inputStyles}
              autoComplete="email"
              maxLength={320}
              required
            />
          </Field>
          <Field id="contact-phone" label="Teléfono o WhatsApp" error={errors.buyerPhone}>
            <input
              id="contact-phone"
              type="tel"
              value={values.buyerPhone}
              onChange={(event) => update('buyerPhone', event.target.value)}
              onBlur={() =>
                setErrors((current) => ({ ...current, buyerPhone: validate(values).buyerPhone }))
              }
              className={inputStyles}
              autoComplete="tel"
              placeholder="300 123 4567"
              maxLength={20}
              required
            />
          </Field>
        </div>

        <Field
          id="contact-message"
          label="Mensaje"
          hint={`${values.message.trim().length}/2000 caracteres`}
          error={errors.message}
        >
          <textarea
            id="contact-message"
            value={values.message}
            onChange={(event) => update('message', event.target.value)}
            onBlur={() =>
              setErrors((current) => ({ ...current, message: validate(values).message }))
            }
            className={cx(inputStyles, 'min-h-28 resize-y')}
            maxLength={2000}
            placeholder="Hola, me interesa este artículo. ¿Sigue disponible? ¿Acepta alguna forma de pago?"
            required
          />
        </Field>

        {/* Honeypot: invisible para personas, tentador para bots. */}
        <div aria-hidden="true" className="hidden">
          <label htmlFor="contact-website">No completes este campo</label>
          <input
            id="contact-website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={values.website}
            onChange={(event) => update('website', event.target.value)}
          />
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700">
          <input
            type="checkbox"
            checked={values.consent}
            onChange={(event) => update('consent', event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          />
          <span>
            Autorizo a {businessName} a usar mi nombre, correo y teléfono para responderme por este
            mensaje. MarketCentral guarda el contacto por 12 meses y no lo comparte con otros
            negocios.
          </span>
        </label>
        {errors.consent ? <p className="text-xs text-red-700">{errors.consent}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={buttonStyles('secondary')}>
            Cancelar
          </button>
          <button type="submit" disabled={!canSubmit} className={buttonStyles('primary')}>
            {sending
              ? 'Enviando…'
              : !readyToSend
                ? `Espera ${Math.max(secondsLeft, 1)} s…`
                : 'Enviar mensaje'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ContactBusinessButton({
  businessSlug,
  businessName,
  listingSlug,
  listingTitle,
  variant = 'primary',
  label = 'Enviar mensaje al negocio',
}: ContactBusinessButtonProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === 'primary' ? buttonStyles('primary') : cx(buttonStyles('secondary'), 'w-full')
        }
      >
        {label}
      </button>
      {open ? (
        <ContactForm
          businessSlug={businessSlug}
          businessName={businessName}
          listingSlug={listingSlug}
          listingTitle={listingTitle}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
