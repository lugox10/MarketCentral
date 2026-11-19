'use client';

import { useId, useState } from 'react';

import { ApiError } from '@/lib/api';
import { REPORT_REASONS, reportErrorMessage, submitReport, type ReportReason } from '@/lib/reports';
import { Modal } from '@/components/modal';
import { Banner, Field, buttonStyles, inputStyles } from '@/components/taxonomy-ui';

interface ReportListingButtonProps {
  businessSlug: string;
  businessName: string;
  listingSlug: string;
  listingTitle: string;
}

/**
 * Botón discreto de denuncia. Es intencionalmente pequeño y de bajo contraste:
 * denunciar no debe competir con contactar al negocio.
 */
export function ReportListingButton({
  businessSlug,
  businessName,
  listingSlug,
  listingTitle,
}: ReportListingButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-stone-500 underline decoration-stone-300 underline-offset-2 hover:text-stone-700"
      >
        Reportar este producto
      </button>
      {open ? (
        <ReportModal
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

interface ReportModalProps extends ReportListingButtonProps {
  onClose: () => void;
}

function ReportModal({
  businessSlug,
  businessName,
  listingSlug,
  listingTitle,
  onClose,
}: ReportModalProps) {
  const formId = useId();
  const [reason, setReason] = useState<ReportReason>('SCAM');
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    if (reason === 'OTHER' && details.trim().length < 10) {
      setError('Cuéntanos qué pasa: necesitamos al menos 10 caracteres.');
      return;
    }
    if (details.trim().length > 0 && details.trim().length < 10) {
      setError('Si agregas detalles, escríbenos al menos 10 caracteres.');
      return;
    }

    setSending(true);
    setError(null);
    try {
      await submitReport({
        businessSlug,
        listingSlug,
        reason,
        details: details.trim() || undefined,
        reporterEmail: email.trim() || undefined,
        website,
      });
      setSent(true);
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : undefined;
      setError(reportErrorMessage(code, 'No pudimos enviar el reporte. Inténtalo de nuevo.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open
      title="Reportar este producto"
      description={`${listingTitle} · ${businessName}`}
      onClose={onClose}
      footer={
        sent ? (
          <button type="button" onClick={onClose} className={buttonStyles('primary')}>
            Cerrar
          </button>
        ) : (
          <>
            <button type="button" onClick={onClose} className={buttonStyles('secondary')}>
              Cancelar
            </button>
            <button
              type="submit"
              form={formId}
              disabled={sending}
              className={buttonStyles('primary')}
            >
              {sending ? 'Enviando…' : 'Enviar reporte'}
            </button>
          </>
        )
      }
    >
      {sent ? (
        <div className="space-y-3">
          <p className="text-sm text-stone-700">
            Gracias. Recibimos tu reporte y nuestro equipo lo va a revisar.
          </p>
          <p className="text-xs text-stone-500">
            No compartimos tu identidad con el negocio. Si dejaste un correo, solo lo usaremos para
            pedirte más contexto si hace falta.
          </p>
        </div>
      ) : (
        <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
          {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}

          <Field id="report-reason" label="Motivo" hint="Elige lo que mejor describa el problema.">
            <select
              id="report-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as ReportReason)}
              className={inputStyles}
            >
              {REPORT_REASONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} — {option.hint}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="report-details"
            label={reason === 'OTHER' ? '¿Qué pasa?' : 'Detalles (opcional)'}
            hint="Mínimo 10 caracteres si escribes algo. No incluyas datos de pago."
            error={error ?? undefined}
          >
            <textarea
              id="report-details"
              rows={4}
              maxLength={2000}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              className={inputStyles}
              placeholder="Ejemplo: me pidió un anticipo por Nequi antes de mostrarme el artículo."
            />
          </Field>

          <Field
            id="report-email"
            label="Tu correo (opcional)"
            hint="Solo si quieres que te escribamos para ampliar la información."
          >
            <input
              id="report-email"
              type="email"
              autoComplete="email"
              maxLength={320}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputStyles}
              placeholder="tu@correo.com"
            />
          </Field>

          {/* Honeypot: invisible para personas, tentador para bots. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="report-website">Sitio web</label>
            <input
              id="report-website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>

          <p className="text-xs text-stone-500">
            Revisamos los reportes manualmente. MarketCentral no intermedia la compra ni el pago.
          </p>
        </form>
      )}
    </Modal>
  );
}
