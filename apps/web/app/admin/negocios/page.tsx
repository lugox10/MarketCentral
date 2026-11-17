'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiError, getJson, patchJson } from '../../../src/lib/api';
import { cityLabel, type AdminBusiness } from '../../../src/lib/business';

export default function AdminBusinessesPage(): React.ReactElement {
  const router = useRouter();
  const [rows, setRows] = useState<AdminBusiness[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function load(): Promise<void> {
    const list = await getJson<AdminBusiness[]>('/admin/businesses');
    setRows(list);
  }

  useEffect(() => {
    let cancelled = false;
    getJson<AdminBusiness[]>('/admin/businesses')
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/login');
          return;
        }
        if (cause instanceof ApiError && cause.status === 403) {
          setError('Esta sección es solo para administradores de la plataforma.');
          return;
        }
        setError('No se pudieron cargar los negocios.');
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function toggle(row: AdminBusiness): Promise<void> {
    const nextStatus = row.status === 'APPROVED' ? 'SUSPENDED' : 'APPROVED';
    setPendingId(row.id);
    setError(null);
    try {
      await patchJson(`/admin/businesses/${row.id}/status`, { status: nextStatus });
      await load();
    } catch (cause: unknown) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo cambiar el estado.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-stone-900">Negocios registrados</h1>
      <p className="mt-1 text-sm text-stone-600">
        Suspender un negocio lo oculta del catálogo público sin archivar sus publicaciones.
      </p>

      {error ? (
        <p role="alert" className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {rows === null && !error ? <p className="mt-6 text-sm text-stone-600">Cargando…</p> : null}

      {rows && rows.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">Todavía no hay negocios registrados.</p>
      ) : null}

      {rows && rows.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <caption className="sr-only">Listado de negocios de la plataforma</caption>
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-600">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Nombre
                </th>
                <th scope="col" className="px-4 py-3">
                  Ciudad
                </th>
                <th scope="col" className="px-4 py-3">
                  Dueño
                </th>
                <th scope="col" className="px-4 py-3">
                  Estado
                </th>
                <th scope="col" className="px-4 py-3">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium text-stone-900">{row.name}</td>
                  <td className="px-4 py-3 text-stone-700">{cityLabel(row.city)}</td>
                  <td className="px-4 py-3 text-stone-700">
                    {row.owner ? (
                      <>
                        {row.owner.name}
                        <br />
                        <span className="text-xs text-stone-500">{row.owner.email}</span>
                      </>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.status === 'APPROVED'
                          ? 'rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700'
                          : 'rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800'
                      }
                    >
                      {row.status === 'APPROVED' ? 'Aprobado' : 'Suspendido'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void toggle(row)}
                      disabled={pendingId === row.id}
                      className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-100 disabled:opacity-60"
                    >
                      {pendingId === row.id
                        ? 'Guardando…'
                        : row.status === 'APPROVED'
                          ? 'Suspender'
                          : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
