'use client';

import { useCallback, useEffect, useId, useState } from 'react';

import { ApiError, getJson } from '@/lib/api';
import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  REPORT_STATUS_TONES,
  archiveListing,
  fetchReportSummary,
  fetchReports,
  reportErrorMessage,
  suspendBusiness,
  updateReportStatus,
  type ModerationSummary,
  type Report,
  type ReportPage,
  type ReportReason,
  type ReportStatus,
} from '@/lib/reports';
import {
  Badge,
  Banner,
  EmptyState,
  SearchField,
  SkeletonList,
  StatCard,
  buttonStyles,
  inputStyles,
} from '@/components/taxonomy-ui';
import { Modal } from '@/components/modal';

const PAGE_SIZE = 10;

type ActionKind = 'REVIEWED' | 'RESOLVED' | 'DISMISSED' | 'SUSPEND' | 'ARCHIVE';

const ACTION_COPY: Record<ActionKind, { title: string; label: string; hint: string }> = {
  REVIEWED: {
    title: 'Marcar en revisión',
    label: 'Nota interna (opcional)',
    hint: 'Útil para dejar constancia de lo que estás verificando.',
  },
  RESOLVED: {
    title: 'Resolver reporte',
    label: 'Qué se hizo (obligatorio)',
    hint: 'Ejemplo: se contactó al negocio y corrigió la publicación.',
  },
  DISMISSED: {
    title: 'Descartar reporte',
    label: 'Por qué se descarta (obligatorio)',
    hint: 'Ejemplo: las fotos y el artículo son originales del negocio.',
  },
  SUSPEND: {
    title: 'Suspender negocio',
    label: 'Motivo de la suspensión (obligatorio)',
    hint: 'El negocio deja de verse en el catálogo y sus publicaciones se ocultan.',
  },
  ARCHIVE: {
    title: 'Archivar publicación',
    label: 'Motivo del archivado (obligatorio)',
    hint: 'La publicación no se puede republicar; queda el rastro en auditoría.',
  },
};

export default function AdminReportsPage() {
  const [me, setMe] = useState<{ role: string; name: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportPage | null>(null);
  const [summary, setSummary] = useState<ModerationSummary | null>(null);
  const [status, setStatus] = useState<ReportStatus | ''>('PENDING');
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState<{ kind: ActionKind; report: Report } | null>(null);
  const [detail, setDetail] = useState<Report | null>(null);

  useEffect(() => {
    let cancelled = false;
    getJson<{ role: string; name: string }>('/auth/me')
      .then((profile) => {
        if (!cancelled) setMe(profile);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reports, counters] = await Promise.all([
        fetchReports({
          status,
          reason,
          q: query,
          page,
          limit: PAGE_SIZE,
        }),
        fetchReportSummary(),
      ]);
      setData(reports);
      setSummary(counters);
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : undefined;
      setError(reportErrorMessage(code, 'No pudimos cargar los reportes.'));
    } finally {
      setLoading(false);
    }
  }, [status, reason, query, page]);

  useEffect(() => {
    if (me?.role !== 'SUPER_ADMIN') return;
    // Diferido para no encadenar renders dentro del efecto (regla react-hooks).
    void Promise.resolve().then(() => load());
  }, [me, load]);

  async function runAction(kind: ActionKind, report: Report, text: string): Promise<string | null> {
    const trimmed = text.trim();
    try {
      if (kind === 'SUSPEND') {
        const result = await suspendBusiness(report.business.id, trimmed);
        setNotice(result.message);
      } else if (kind === 'ARCHIVE') {
        if (!report.listing) return 'Este reporte no apunta a una publicación.';
        const result = await archiveListing(report.listing.id, trimmed, report.id);
        setNotice(result.message);
      } else {
        await updateReportStatus(report.id, { status: kind, note: trimmed || undefined });
        setNotice(`Reporte actualizado a «${REPORT_STATUS_LABELS[kind]}».`);
      }
      setAction(null);
      await load();
      return null;
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : undefined;
      return reportErrorMessage(code, 'No pudimos completar la acción.');
    }
  }

  if (checking) {
    return (
      <div className="space-y-4">
        <SkeletonList rows={4} />
      </div>
    );
  }

  if (!me || me.role !== 'SUPER_ADMIN') {
    return (
      <Banner
        tone="error"
        message="Solo un administrador de plataforma puede ver la bandeja de reportes."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Moderación</p>
        <h1 className="mt-1 text-2xl font-semibold text-stone-900">Reportes</h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Denuncias enviadas por compradores. Aquí puedes revisar, resolver, descartar, suspender el
          negocio o archivar la publicación. Cada acción queda auditada.
        </p>
      </header>

      {notice ? <Banner tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}
      {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pendientes" value={summary?.pending ?? 0} hint="Requieren revisión" />
        <StatCard label="En revisión" value={summary?.reviewed ?? 0} hint="Investigando" />
        <StatCard
          label="Resueltos hoy"
          value={summary?.resolvedToday ?? 0}
          hint="Desde medianoche"
        />
        <StatCard
          label="Negocios suspendidos"
          value={summary?.suspendedBusinesses ?? 0}
          hint="Fuera del catálogo"
        />
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="filter-status" className="text-xs font-medium text-stone-600">
              Estado
            </label>
            <select
              id="filter-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as ReportStatus | '');
                setPage(1);
              }}
              className={inputStyles}
            >
              <option value="">Todos</option>
              {REPORT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {REPORT_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-reason" className="text-xs font-medium text-stone-600">
              Motivo
            </label>
            <select
              id="filter-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value as ReportReason | '');
                setPage(1);
              }}
              className={inputStyles}
            >
              <option value="">Todos</option>
              {REPORT_REASONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <SearchField
              id="filter-search"
              label="Buscar por negocio, publicación o correo"
              value={search}
              onChange={setSearch}
              placeholder="Ej. iPhone, Prendería Centro, correo@dominio.com"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className={buttonStyles('secondary', 'sm')}
                onClick={() => {
                  setQuery(search);
                  setPage(1);
                }}
              >
                Buscar
              </button>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <SkeletonList rows={5} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No hay reportes con estos filtros"
          description="Cuando alguien denuncie una publicación aparecerá aquí."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-stone-200 lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">Reporte</th>
                  <th className="px-4 py-3">Negocio / publicación</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.items.map((report) => (
                  <tr key={report.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-900">
                        {REPORT_REASON_LABELS[report.reason]}
                      </p>
                      <p className="mt-1 line-clamp-2 max-w-xs text-xs text-stone-500">
                        {report.details ?? 'Sin detalles adicionales.'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-stone-800">{report.business.name}</p>
                      <p className="text-xs text-stone-500">
                        {report.listing ? report.listing.title : 'Perfil del negocio'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={REPORT_STATUS_TONES[report.status]}>
                        {REPORT_STATUS_LABELS[report.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-500">
                      {formatDate(report.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        <button
                          type="button"
                          className={buttonStyles('ghost', 'sm')}
                          onClick={() => setDetail(report)}
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          className={buttonStyles('secondary', 'sm')}
                          onClick={() => setAction({ kind: 'RESOLVED', report })}
                        >
                          Resolver
                        </button>
                        <button
                          type="button"
                          className={buttonStyles('ghost', 'sm')}
                          onClick={() => setAction({ kind: 'DISMISSED', report })}
                        >
                          Descartar
                        </button>
                        <button
                          type="button"
                          className={buttonStyles('secondary', 'sm')}
                          onClick={() => setAction({ kind: 'SUSPEND', report })}
                        >
                          Suspender negocio
                        </button>
                        {report.listing ? (
                          <button
                            type="button"
                            className={buttonStyles('ghost', 'sm')}
                            onClick={() => setAction({ kind: 'ARCHIVE', report })}
                          >
                            Archivar publicación
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 lg:hidden">
            {data.items.map((report) => (
              <li key={report.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-stone-900">
                    {REPORT_REASON_LABELS[report.reason]}
                  </p>
                  <Badge tone={REPORT_STATUS_TONES[report.status]}>
                    {REPORT_STATUS_LABELS[report.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  {report.business.name} ·{' '}
                  {report.listing ? report.listing.title : 'Perfil del negocio'}
                </p>
                <p className="mt-2 line-clamp-3 text-sm text-stone-700">
                  {report.details ?? 'Sin detalles adicionales.'}
                </p>
                <p className="mt-2 text-[11px] text-stone-500">{formatDate(report.createdAt)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={buttonStyles('ghost', 'sm')}
                    onClick={() => setDetail(report)}
                  >
                    Ver
                  </button>
                  <button
                    type="button"
                    className={buttonStyles('secondary', 'sm')}
                    onClick={() => setAction({ kind: 'RESOLVED', report })}
                  >
                    Resolver
                  </button>
                  <button
                    type="button"
                    className={buttonStyles('ghost', 'sm')}
                    onClick={() => setAction({ kind: 'DISMISSED', report })}
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    className={buttonStyles('secondary', 'sm')}
                    onClick={() => setAction({ kind: 'SUSPEND', report })}
                  >
                    Suspender
                  </button>
                  {report.listing ? (
                    <button
                      type="button"
                      className={buttonStyles('ghost', 'sm')}
                      onClick={() => setAction({ kind: 'ARCHIVE', report })}
                    >
                      Archivar
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between text-sm text-stone-600">
            <p>
              {data.total} reporte(s) · página {data.page} de {data.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={buttonStyles('secondary', 'sm')}
                disabled={data.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </button>
              <button
                type="button"
                className={buttonStyles('secondary', 'sm')}
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}

      {detail ? <ReportDetailModal report={detail} onClose={() => setDetail(null)} /> : null}

      {action ? (
        <ReportActionModal
          kind={action.kind}
          report={action.report}
          onClose={() => setAction(null)}
          onSubmit={(text) => runAction(action.kind, action.report, text)}
        />
      ) : null}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function ReportDetailModal({ report, onClose }: { report: Report; onClose: () => void }) {
  return (
    <Modal
      open
      title={REPORT_REASON_LABELS[report.reason]}
      description={`${report.business.name}${report.listing ? ` · ${report.listing.title}` : ''}`}
      onClose={onClose}
      footer={
        <button type="button" className={buttonStyles('secondary')} onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Estado</dt>
          <dd className="mt-1">
            <Badge tone={REPORT_STATUS_TONES[report.status]}>
              {REPORT_STATUS_LABELS[report.status]}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Detalles</dt>
          <dd className="mt-1 whitespace-pre-line text-stone-800">
            {report.details ?? 'El denunciante no agregó detalles.'}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Denunciante</dt>
          <dd className="mt-1 text-stone-700">
            {report.reporterUserId ? 'Usuario con sesión' : 'Anónimo'}
            {report.reporterEmail ? ` · ${report.reporterEmail}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Recibido</dt>
          <dd className="mt-1 text-stone-700">{formatDate(report.createdAt)}</dd>
        </div>
        {report.resolutionNote ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Resolución</dt>
            <dd className="mt-1 text-stone-700">
              {report.resolutionNote}
              {report.resolvedByName ? ` · ${report.resolvedByName}` : ''}
            </dd>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3 pt-1 text-sm">
          <a className="text-brand-700 hover:underline" href={`/negocio/${report.business.slug}`}>
            Ver tienda
          </a>
          {report.listing ? (
            <a
              className="text-brand-700 hover:underline"
              href={`/producto/${report.business.slug}/${report.listing.slug}`}
            >
              Ver publicación
            </a>
          ) : null}
        </div>
      </dl>
    </Modal>
  );
}

function ReportActionModal({
  kind,
  report,
  onClose,
  onSubmit,
}: {
  kind: ActionKind;
  report: Report;
  onClose: () => void;
  onSubmit: (text: string) => Promise<string | null>;
}) {
  const formId = useId();
  const copy = ACTION_COPY[kind];
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const required = kind !== 'REVIEWED';

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    if (required && text.trim().length < 5) {
      setError('Escribe al menos 5 caracteres para dejar constancia.');
      return;
    }
    setSending(true);
    setError(null);
    const message = await onSubmit(text);
    setSending(false);
    if (message) setError(message);
  }

  return (
    <Modal
      open
      title={copy.title}
      description={`${report.business.name}${report.listing ? ` · ${report.listing.title}` : ''}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={buttonStyles('secondary')} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form={formId}
            disabled={sending}
            className={buttonStyles('primary')}
          >
            {sending ? 'Guardando…' : 'Confirmar'}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}
        <div>
          <label htmlFor="action-text" className="text-xs font-medium text-stone-600">
            {copy.label}
          </label>
          <textarea
            id="action-text"
            rows={4}
            maxLength={500}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className={inputStyles}
            placeholder={copy.hint}
          />
          <p className="mt-1 text-xs text-stone-500">{copy.hint}</p>
        </div>
        <p className="text-xs text-stone-500">
          Esta acción queda registrada en la auditoría con tu usuario y la fecha.
        </p>
      </form>
    </Modal>
  );
}
