'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Modal } from '../../../src/components/modal';
import {
  Badge,
  Banner,
  buttonStyles,
  cx,
  EmptyState,
  Field,
  inputStyles,
  SearchField,
  SkeletonList,
  StatCard,
} from '../../../src/components/taxonomy-ui';
import { ApiError, getJson } from '../../../src/lib/api';
import type { MyBusiness } from '../../../src/lib/business';
import {
  BUSINESS_SETTABLE_STATUSES,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONES,
  fetchLead,
  fetchLeadSummary,
  fetchLeads,
  formatLeadDate,
  leadErrorMessage,
  updateLeadStatus,
  type Lead,
  type LeadList,
  type LeadStatus,
  type LeadSummary,
} from '../../../src/lib/leads';

const PAGE_SIZE = 10;

export default function LeadsPage(): React.ReactElement {
  const router = useRouter();
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadList | null>(null);
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getJson('/auth/me');
        const mine = await getJson<MyBusiness>('/businesses/me');
        if (!cancelled) setBusinessName(mine.business.name);
      } catch (cause: unknown) {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/login');
          return;
        }
        if (cause instanceof ApiError && cause.status === 404) {
          router.replace('/dashboard/onboarding');
          return;
        }
        setError('No pudimos cargar tu negocio.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, stats] = await Promise.all([
        fetchLeads({ status, search: query, page, limit: PAGE_SIZE }),
        fetchLeadSummary(),
      ]);
      setLeads(list);
      setSummary(stats);
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace('/login');
        return;
      }
      setError('No pudimos cargar los contactos. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [page, query, status, router]);

  useEffect(() => {
    if (!businessName) return;
    // Se difiere un tick para no llamar a setState de forma síncrona dentro del efecto.
    void Promise.resolve().then(() => load());
  }, [businessName, load]);

  async function openLead(lead: Lead): Promise<void> {
    setSelected(lead);
    setDetailBusy(true);
    try {
      const detail = await fetchLead(lead.id);
      setSelected(detail);
      if (detail.status !== lead.status) {
        setLeads((current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) => (item.id === detail.id ? detail : item)),
              }
            : current,
        );
        setSummary((current) =>
          current ? { ...current, unreadCount: Math.max(current.unreadCount - 1, 0) } : current,
        );
      }
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 404) {
        setNotice('Ese contacto ya no está disponible.');
        setSelected(null);
        void load();
      }
    } finally {
      setDetailBusy(false);
    }
  }

  async function changeStatus(next: LeadStatus): Promise<void> {
    if (!selected || actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      const updated = await updateLeadStatus(selected.id, next);
      setSelected(updated);
      setNotice(`Contacto marcado como «${LEAD_STATUS_LABELS[next]}».`);
      await load();
    } catch (cause: unknown) {
      if (cause instanceof ApiError) {
        setError(leadErrorMessage(cause.code, 'No pudimos actualizar el contacto.'));
      } else {
        setError('No pudimos actualizar el contacto.');
      }
    } finally {
      setActionBusy(false);
    }
  }

  const items = leads?.items ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <nav aria-label="Ruta de navegación" className="text-xs text-stone-500">
            Panel / <span className="text-stone-700">Contactos</span>
          </nav>
          <h1 className="mt-1 text-2xl font-semibold text-stone-900 sm:text-3xl">Contactos</h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">
            Mensajes que los compradores envían desde tus publicaciones y desde tu perfil público.
            Respondes por fuera de la plataforma: aquí solo se registra el contacto.
          </p>
        </div>
        <Link href="/dashboard/inventario" className={buttonStyles('secondary')}>
          Ir al inventario
        </Link>
      </header>

      {notice ? <Banner tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}
      {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sin leer" value={summary?.unreadCount ?? 0} hint="Mensajes nuevos" />
        <StatCard label="Total" value={summary?.total ?? 0} hint="Contactos recibidos" />
        <StatCard
          label="En pantalla"
          value={leads?.total ?? 0}
          hint={status || query ? 'Con filtros activos' : 'Todos los contactos'}
        />
        <StatCard
          label="Respondidos"
          value={items.filter((lead) => lead.status === 'REPLIED').length}
          hint="En esta página"
        />
      </div>

      <section className="rounded-xl border border-stone-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-end">
          <div className="sm:w-64">
            <SearchField
              id="leads-search"
              label="Buscar contacto"
              value={search}
              onChange={setSearch}
              placeholder="Nombre, correo o mensaje"
            />
          </div>
          <div className="sm:w-44">
            <Field id="leads-status" label="Estado">
              <select
                id="leads-status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as LeadStatus | '');
                  setPage(1);
                }}
                className={inputStyles}
              >
                <option value="">Todos</option>
                {(['NEW', 'READ', 'REPLIED', 'ARCHIVED', 'SPAM'] as LeadStatus[]).map((value) => (
                  <option key={value} value={value}>
                    {LEAD_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <button
            type="button"
            onClick={() => {
              setQuery(search);
              setPage(1);
            }}
            className={buttonStyles('secondary')}
          >
            Buscar
          </button>
        </div>

        {loading && !leads ? (
          <div className="p-4">
            <SkeletonList rows={5} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={status || query ? 'Sin contactos con esos filtros' : 'Aún no tienes contactos'}
              description={
                status || query
                  ? 'Prueba con otro estado o limpia la búsqueda.'
                  : 'Cuando alguien escriba desde una publicación o desde tu perfil, aparecerá aquí.'
              }
              action={
                <Link href="/dashboard/inventario" className={buttonStyles('primary', 'sm')}>
                  Revisar inventario
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Contacto</th>
                    <th className="px-4 py-2 font-medium">Origen</th>
                    <th className="px-4 py-2 font-medium">Mensaje</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                    <th className="px-4 py-2 font-medium">Recibido</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((lead) => (
                    <tr
                      key={lead.id}
                      className="cursor-pointer border-b border-stone-100 last:border-0 hover:bg-stone-50"
                      onClick={() => void openLead(lead)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-900">{lead.buyerName}</p>
                        <p className="text-xs text-stone-500">{lead.buyerPhone}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-600">
                        {LEAD_SOURCE_LABELS[lead.source]}
                        {lead.listingTitle ? (
                          <span className="block max-w-40 truncate text-stone-500">
                            {lead.listingTitle}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <p className="line-clamp-2 max-w-sm text-stone-700">{lead.message}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={LEAD_STATUS_TONES[lead.status]}>
                          {LEAD_STATUS_LABELS[lead.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-500">
                        {formatLeadDate(lead.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-stone-100 lg:hidden">
              {items.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    onClick={() => void openLead(lead)}
                    className="w-full space-y-1 p-4 text-left hover:bg-stone-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-stone-900">{lead.buyerName}</span>
                      <Badge tone={LEAD_STATUS_TONES[lead.status]}>
                        {LEAD_STATUS_LABELS[lead.status]}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-sm text-stone-600">{lead.message}</p>
                    <p className="text-[11px] text-stone-500">
                      {LEAD_SOURCE_LABELS[lead.source]} · {formatLeadDate(lead.createdAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between gap-3 border-t border-stone-200 p-4 text-xs text-stone-600">
              <span>
                {leads?.total ?? 0} contacto(s) · página {leads?.page ?? 1} de{' '}
                {leads?.totalPages ?? 1}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                  className={buttonStyles('secondary', 'sm')}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= (leads?.totalPages ?? 1) || loading}
                  onClick={() => setPage((current) => current + 1)}
                  className={buttonStyles('secondary', 'sm')}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {selected ? (
        <Modal
          open
          title={selected.buyerName}
          description={`${LEAD_SOURCE_LABELS[selected.source]} · ${formatLeadDate(selected.createdAt)}`}
          onClose={() => setSelected(null)}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={LEAD_STATUS_TONES[selected.status]}>
                {LEAD_STATUS_LABELS[selected.status]}
              </Badge>
              <span className="text-xs text-stone-500">
                Se conserva hasta {formatLeadDate(selected.expiresAt)}
              </span>
            </div>

            {selected.listingTitle ? (
              <p className="text-sm text-stone-700">
                Sobre la publicación <span className="font-medium">{selected.listingTitle}</span>
              </p>
            ) : null}

            <p className="whitespace-pre-line rounded-lg bg-stone-50 p-3 text-sm text-stone-800">
              {selected.message}
            </p>

            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-stone-500">Correo</dt>
                <dd className="break-all text-stone-800">{selected.buyerEmail}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-stone-500">Teléfono</dt>
                <dd className="text-stone-800">{selected.buyerPhone}</dd>
              </div>
            </dl>

            <div className="rounded-lg border border-stone-200 bg-white p-3 text-xs text-stone-600">
              Responde por tu correo o WhatsApp. MarketCentral no envía mensajes en tu nombre: solo
              guarda el contacto.
            </div>

            <div className="flex flex-wrap gap-2">
              {BUSINESS_SETTABLE_STATUSES.map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={actionBusy || detailBusy || selected.status === value}
                  onClick={() => void changeStatus(value)}
                  className={cx(
                    value === 'SPAM'
                      ? buttonStyles('ghost', 'sm')
                      : buttonStyles('secondary', 'sm'),
                  )}
                >
                  {value === 'REPLIED'
                    ? 'Marcar respondido'
                    : value === 'ARCHIVED'
                      ? 'Archivar'
                      : 'Marcar spam'}
                </button>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
