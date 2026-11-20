'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { ApiError, getJson } from '../../../src/lib/api';
import { canAccessTaxonomy, isPlatformAdmin } from '../../../src/lib/authz';
import {
  ATTRIBUTE_TYPE_LABELS,
  type AttributeDefinition,
  type AttributeOption,
  type Category,
  type Vertical,
  createAttribute,
  createCategory,
  createVertical,
  createAttributeOption,
  fetchAdminAttributes,
  fetchAdminCategories,
  fetchAdminVerticals,
  updateAttribute,
  updateCategory,
  updateOption,
  updateVertical,
} from '../../../src/lib/taxonomy';
import {
  AttributeEditForm,
  CategoryEditForm,
  VerticalEditForm,
  type AttributeEditPayload,
} from './taxonomy-edit-forms';
import {
  AttributeForm,
  CategoryForm,
  VerticalForm,
  type AttributePayload,
  type CategoryPayload,
  type VerticalPayload,
} from './taxonomy-forms';
import {
  Badge,
  Banner,
  EmptyState,
  SearchField,
  SkeletonList,
  StatCard,
  buttonStyles,
  cx,
} from '../../../src/components/taxonomy-ui';

interface Me {
  role: string;
}

type ModalKind = 'vertical' | 'category' | 'attribute';

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matches(value: string, query: string): boolean {
  if (!query.trim()) return true;
  return normalize(value).includes(normalize(query));
}

function describeError(cause: unknown, conflictMessage?: string): string {
  if (cause instanceof ApiError) {
    if (cause.status === 409) {
      return conflictMessage ?? 'Ya existe un registro con esos datos.';
    }
    if (cause.status === 403) return 'No tienes permisos para esta acción.';
    if (cause.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    if (cause.status === 404) return 'El recurso ya no existe. Recarga la página.';
    return cause.message;
  }

  return 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
}

function Panel({
  title,
  subtitle,
  count,
  actions,
  children,
  labelledBy,
}: {
  title: string;
  subtitle: string;
  count: number | null;
  actions?: ReactNode;
  children: ReactNode;
  labelledBy: string;
}): ReactElement {
  return (
    <section
      aria-labelledby={labelledBy}
      className="flex min-w-0 flex-col rounded-2xl border border-stone-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <div className="min-w-0">
          <h2
            id={labelledBy}
            className="flex items-center gap-2 text-sm font-semibold text-stone-900"
          >
            {title}
            {count === null ? null : (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-stone-600">
                {count}
              </span>
            )}
          </h2>
          <p className="mt-0.5 truncate text-xs text-stone-500">{subtitle}</p>
        </div>
        {actions}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">{children}</div>
    </section>
  );
}

function ListItemButton({
  selected,
  onClick,
  action,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  action?: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onClick();
      }}
      aria-current={selected ? 'true' : undefined}
      className={cx(
        'group w-full min-w-0 cursor-pointer rounded-xl border px-3 py-2.5 text-left transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700',
        selected
          ? 'border-brand-700 bg-brand-50/70 shadow-sm'
          : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50',
      )}
    >
      {children}
      {action ? <div className="mt-2 flex justify-end">{action}</div> : null}
    </div>
  );
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }): ReactElement {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="rounded-md p-1 text-stone-400 transition hover:bg-stone-100 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z" />
        <path d="m13.5 6.5 4 4" />
      </svg>
    </button>
  );
}

function StatusToggle({
  active,
  busy,
  onClick,
  children,
}: {
  active: boolean;
  busy: boolean;
  onClick: () => void;
  children: ReactNode;
}): ReactElement {
  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={active}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cx(
        'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700',
        active
          ? 'border-stone-300 bg-white text-stone-600 hover:bg-stone-100'
          : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100',
        busy && 'cursor-progress opacity-60',
      )}
    >
      {busy ? 'Guardando…' : children}
    </button>
  );
}

export default function AdminTaxonomyPage(): ReactElement {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [selectedVerticalId, setSelectedVerticalId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);

  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [attributeCounts, setAttributeCounts] = useState<Record<string, number>>({});

  const [loadingVerticals, setLoadingVerticals] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingAttributes, setLoadingAttributes] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [verticalQuery, setVerticalQuery] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [attributeQuery, setAttributeQuery] = useState('');

  const [modal, setModal] = useState<ModalKind | null>(null);
  const [editing, setEditing] = useState<{
    kind: 'vertical' | 'category' | 'attribute';
    id: string;
  } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const selectedVertical = useMemo(
    () => verticals.find((vertical) => vertical.id === selectedVerticalId) ?? null,
    [verticals, selectedVerticalId],
  );

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const filteredVerticals = useMemo(
    () =>
      verticals.filter((vertical) => matches(`${vertical.name} ${vertical.slug}`, verticalQuery)),
    [verticals, verticalQuery],
  );

  const filteredCategories = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category]));
    return categories.filter((category) => {
      const parent = category.parentId ? byId.get(category.parentId) : undefined;
      return matches(`${category.name} ${category.slug} ${parent?.name ?? ''}`, categoryQuery);
    });
  }, [categories, categoryQuery]);

  const filteredAttributes = useMemo(
    () =>
      attributes.filter((attribute) =>
        matches(`${attribute.name} ${attribute.code}`, attributeQuery),
      ),
    [attributes, attributeQuery],
  );

  const loadVerticals = useCallback(async (): Promise<void> => {
    setLoadingVerticals(true);
    try {
      const list = await fetchAdminVerticals();
      setVerticals(list);

      const entries = await Promise.all(
        list.map(async (vertical) => {
          try {
            const items = await fetchAdminCategories(vertical.id);
            return [vertical.id, items.length] as const;
          } catch {
            return null;
          }
        }),
      );

      setCategoryCounts((current) => {
        const next = { ...current };
        for (const entry of entries) {
          if (entry) next[entry[0]] = entry[1];
        }
        return next;
      });
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setLoadingVerticals(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    getJson<Me>('/auth/me')
      .then((me) => {
        if (cancelled) return;
        if (!isPlatformAdmin(me.role)) {
          setForbidden(!canAccessTaxonomy(me.role));
          setChecking(false);
          return;
        }
        setChecking(false);
        void loadVerticals();
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/login');
          return;
        }
        setError(describeError(cause));
        setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadVerticals, router]);

  const prefetchAttributeCounts = useCallback(async (list: Category[]): Promise<void> => {
    const entries = await Promise.all(
      list.map(async (category) => {
        try {
          const items = await fetchAdminAttributes(category.id);
          return [category.id, items.length] as const;
        } catch {
          return null;
        }
      }),
    );

    setAttributeCounts((current) => {
      const next = { ...current };
      for (const entry of entries) {
        if (entry) next[entry[0]] = entry[1];
      }
      return next;
    });
  }, []);

  async function selectVertical(vertical: Vertical): Promise<void> {
    setSelectedVerticalId(vertical.id);
    setSelectedCategoryId(null);
    setAttributes([]);
    setCategoryQuery('');
    setAttributeQuery('');
    setLoadingCategories(true);
    setError(null);
    try {
      const list = await fetchAdminCategories(vertical.id);
      setCategories(list);
      setCategoryCounts((current) => ({ ...current, [vertical.id]: list.length }));
      void prefetchAttributeCounts(list);
    } catch (cause) {
      setError(describeError(cause));
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }

  async function selectCategory(category: Category): Promise<void> {
    setSelectedCategoryId(category.id);
    setAttributeQuery('');
    setLoadingAttributes(true);
    setError(null);
    try {
      const list = await fetchAdminAttributes(category.id);
      setAttributes(list);
      setAttributeCounts((current) => ({ ...current, [category.id]: list.length }));
    } catch (cause) {
      setError(describeError(cause));
      setAttributes([]);
    } finally {
      setLoadingAttributes(false);
    }
  }

  function openModal(kind: ModalKind): void {
    setModal(kind);
  }

  function closeModal(): void {
    setModal(null);
  }

  async function handleCreateVertical(payload: VerticalPayload): Promise<string | null> {
    try {
      const created = await createVertical(payload);
      setVerticals((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryCounts((current) => ({ ...current, [created.id]: 0 }));
      setNotice(`Vertical «${created.name}» creada correctamente.`);
      closeModal();
      return null;
    } catch (cause) {
      return describeError(cause, 'Ya existe una vertical con ese nombre o slug.');
    }
  }

  async function handleCreateCategory(payload: CategoryPayload): Promise<string | null> {
    if (!selectedVertical) return 'Selecciona una vertical primero.';

    try {
      const created = await createCategory({ verticalId: selectedVertical.id, ...payload });
      setCategories((current) => [...current, created]);
      setCategoryCounts((current) => ({
        ...current,
        [selectedVertical.id]: (current[selectedVertical.id] ?? 0) + 1,
      }));
      setAttributeCounts((current) => ({ ...current, [created.id]: 0 }));
      setNotice(`Categoría «${created.name}» creada en ${selectedVertical.name}.`);
      closeModal();
      return null;
    } catch (cause) {
      return describeError(cause, 'Ya existe una categoría con ese slug en esta vertical.');
    }
  }

  async function handleCreateAttribute(payload: AttributePayload): Promise<string | null> {
    if (!selectedCategory) return 'Selecciona una categoría primero.';

    try {
      const created = await createAttribute({ categoryId: selectedCategory.id, ...payload });
      setAttributes((current) => [...current, created]);
      setAttributeCounts((current) => ({
        ...current,
        [selectedCategory.id]: (current[selectedCategory.id] ?? 0) + 1,
      }));
      setNotice(`Atributo «${created.name}» creado en ${selectedCategory.name}.`);
      closeModal();
      return null;
    } catch (cause) {
      return describeError(cause, 'Ya existe un atributo con ese code en esta categoría.');
    }
  }

  /**
   * Activar/desactivar es un borrado lógico: el elemento sigue existiendo y las
   * publicaciones viejas lo conservan, pero deja de ofrecerse en el catálogo y
   * en el formulario de creación de productos.
   */
  async function toggleVertical(vertical: Vertical): Promise<void> {
    const next = !vertical.isActive;
    setBusyKey(`vertical:${vertical.id}`);
    try {
      await updateVertical(vertical.id, { isActive: next });
      setVerticals((current) =>
        current.map((item) => (item.id === vertical.id ? { ...item, isActive: next } : item)),
      );
      setNotice(
        next ? `Vertical «${vertical.name}» activada.` : `Vertical «${vertical.name}» desactivada.`,
      );
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleCategory(category: Category): Promise<void> {
    const next = !category.isActive;
    setBusyKey(`category:${category.id}`);
    try {
      await updateCategory(category.id, { isActive: next });
      setCategories((current) =>
        current.map((item) => (item.id === category.id ? { ...item, isActive: next } : item)),
      );
      setNotice(
        next
          ? `Categoría «${category.name}» activada.`
          : `Categoría «${category.name}» desactivada: no se podrá elegir en publicaciones nuevas.`,
      );
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleAttribute(attribute: AttributeDefinition): Promise<void> {
    const next = !attribute.isActive;
    setBusyKey(`attribute:${attribute.id}`);
    try {
      await updateAttribute(attribute.id, { isActive: next });
      setAttributes((current) =>
        current.map((item) => (item.id === attribute.id ? { ...item, isActive: next } : item)),
      );
      setNotice(
        next
          ? `Atributo «${attribute.name}» activado.`
          : `Atributo «${attribute.name}» desactivado: no se pedirá en publicaciones nuevas.`,
      );
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleOption(
    attribute: AttributeDefinition,
    option: AttributeOption,
  ): Promise<void> {
    const next = !option.isActive;
    setBusyKey(`option:${option.id}`);
    try {
      await updateOption(attribute.id, option.id, { isActive: next });
      setAttributes((current) =>
        current.map((item) =>
          item.id === attribute.id
            ? {
                ...item,
                options: item.options.map((entry) =>
                  entry.id === option.id ? { ...entry, isActive: next } : entry,
                ),
              }
            : item,
        ),
      );
      setNotice(
        next
          ? `Opción «${option.value}» activada.`
          : `Opción «${option.value}» desactivada en «${attribute.name}».`,
      );
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusyKey(null);
    }
  }

  async function saveVerticalEdit(id: string, name: string): Promise<string | null> {
    setBusyKey(`edit:vertical:${id}`);
    try {
      const updated = await updateVertical(id, { name });
      setVerticals((current) => current.map((item) => (item.id === id ? updated : item)));
      setEditing(null);
      setNotice('Vertical actualizada.');
      return null;
    } catch (cause) {
      return describeError(cause);
    } finally {
      setBusyKey(null);
    }
  }

  async function saveCategoryEdit(id: string, name: string): Promise<string | null> {
    setBusyKey(`edit:category:${id}`);
    try {
      const updated = await updateCategory(id, { name });
      setCategories((current) => current.map((item) => (item.id === id ? updated : item)));
      setEditing(null);
      setNotice('Categoría actualizada.');
      return null;
    } catch (cause) {
      return describeError(cause);
    } finally {
      setBusyKey(null);
    }
  }

  async function saveAttributeEdit(
    attribute: AttributeDefinition,
    payload: AttributeEditPayload,
  ): Promise<string | null> {
    setBusyKey(`edit:attribute:${attribute.id}`);
    try {
      const updated = await updateAttribute(attribute.id, payload);
      setAttributes((current) =>
        current.map((item) => (item.id === attribute.id ? updated : item)),
      );
      setNotice('Atributo actualizado.');
      return null;
    } catch (cause) {
      return describeError(cause);
    } finally {
      setBusyKey(null);
    }
  }

  async function addAttributeOption(
    attribute: AttributeDefinition,
    value: string,
  ): Promise<string | null> {
    setBusyKey(`option-add:${attribute.id}`);
    try {
      const option = await createAttributeOption(attribute.id, value);
      setAttributes((current) =>
        current.map((item) =>
          item.id === attribute.id ? { ...item, options: [...item.options, option] } : item,
        ),
      );
      setNotice(`Opción «${option.value}» añadida.`);
      return null;
    } catch (cause) {
      return describeError(cause);
    } finally {
      setBusyKey(null);
    }
  }

  if (checking) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-40 rounded bg-stone-200" />
          <div className="h-8 w-72 max-w-full rounded bg-stone-200" />
          <div className="h-24 max-w-full rounded-xl bg-stone-100" />
        </div>
        <p className="sr-only" role="status">
          Comprobando permisos…
        </p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-stone-900">Administración de taxonomía</h1>
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Esta sección es solo para administradores de la plataforma. Si crees que es un error,
          contacta con el equipo de soporte.
        </div>
        <Link
          className="mt-4 inline-block text-sm font-medium text-brand-700 underline"
          href="/dashboard"
        >
          Volver al panel
        </Link>
      </div>
    );
  }

  const totalCategories = selectedVertical
    ? categories.length
    : Object.values(categoryCounts).reduce((total, value) => total + value, 0);

  const totalAttributes = selectedCategory
    ? attributes.length
    : categories.reduce((total, category) => total + (attributeCounts[category.id] ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <nav aria-label="Ruta de navegación" className="text-xs text-stone-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link
              className="rounded hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
              href="/dashboard"
            >
              Administración
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-stone-700">
            Taxonomía
          </li>
        </ol>
      </nav>

      <header className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            Administración de taxonomía
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">
            Verticales, categorías y atributos configuran el catálogo de toda la plataforma. Los
            cambios aquí afectan a todos los negocios.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonStyles('secondary')} href="/admin/negocios">
            Negocios
          </Link>
          <button
            type="button"
            className={buttonStyles('primary')}
            onClick={() => openModal('vertical')}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none">
              <path
                d="M10 4v12M4 10h12"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
            Nueva vertical
          </button>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Verticales"
          value={verticals.length}
          hint={verticals.length === 1 ? '1 sector activo' : `${verticals.length} sectores activos`}
        />
        <StatCard
          label="Categorías"
          value={totalCategories}
          hint={selectedVertical ? `en ${selectedVertical.name}` : 'en toda la plataforma'}
        />
        <StatCard
          label="Atributos"
          value={totalAttributes}
          hint={
            selectedCategory
              ? `en ${selectedCategory.name}`
              : selectedVertical
                ? `en ${selectedVertical.name}`
                : 'selecciona una categoría'
          }
        />
      </div>

      <div className="mt-4 space-y-2">
        {notice ? (
          <Banner tone="success" message={notice} onDismiss={() => setNotice(null)} />
        ) : null}
        {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-stone-600">
        <span className="font-medium text-stone-500">Ruta:</span>
        <button
          type="button"
          onClick={() => {
            setSelectedVerticalId(null);
            setSelectedCategoryId(null);
            setCategories([]);
            setAttributes([]);
            setCategoryQuery('');
            setAttributeQuery('');
          }}
          className={cx(
            'rounded-full px-2.5 py-1 ring-1 ring-inset transition',
            selectedVerticalId
              ? 'bg-white text-stone-600 ring-stone-300 hover:bg-stone-100'
              : 'bg-brand-50 text-brand-900 ring-brand-700/20',
          )}
        >
          Plataforma
        </button>
        {selectedVertical ? (
          <>
            <span aria-hidden="true">›</span>
            <span className="max-w-[12rem] truncate rounded-full bg-brand-50 px-2.5 py-1 font-medium text-brand-900 ring-1 ring-inset ring-brand-700/20">
              {selectedVertical.name}
            </span>
          </>
        ) : null}
        {selectedCategory ? (
          <>
            <span aria-hidden="true">›</span>
            <span className="max-w-[12rem] truncate rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-800 ring-1 ring-inset ring-stone-300">
              {selectedCategory.name}
            </span>
          </>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel
          labelledBy="panel-verticales"
          title="Verticales"
          subtitle="Sectores comerciales de la plataforma"
          count={verticals.length}
          actions={
            <button
              type="button"
              className={buttonStyles('secondary', 'sm')}
              onClick={() => openModal('vertical')}
            >
              Crear
            </button>
          }
        >
          <SearchField
            id="search-verticales"
            label="Buscar verticales"
            value={verticalQuery}
            onChange={setVerticalQuery}
            placeholder="Buscar por nombre o slug"
            disabled={verticals.length === 0}
          />

          {loadingVerticals ? (
            <SkeletonList rows={3} />
          ) : verticals.length === 0 ? (
            <EmptyState
              title="Sin verticales todavía"
              description="Crea la primera vertical para empezar a organizar el catálogo."
              action={
                <button
                  type="button"
                  className={buttonStyles('primary', 'sm')}
                  onClick={() => openModal('vertical')}
                >
                  Crear vertical
                </button>
              }
            />
          ) : filteredVerticals.length === 0 ? (
            <EmptyState
              title="Sin coincidencias"
              description={`No hay verticales que coincidan con «${verticalQuery}».`}
            />
          ) : (
            <ul className="space-y-2 lg:max-h-[26rem] lg:overflow-y-auto lg:pr-1">
              {filteredVerticals.map((vertical) => {
                const count = categoryCounts[vertical.id];
                return (
                  <li key={vertical.id} className="min-w-0">
                    <ListItemButton
                      selected={vertical.id === selectedVerticalId}
                      onClick={() => void selectVertical(vertical)}
                      action={
                        <span className="flex items-center gap-1">
                          <EditButton
                            label={`Editar ${vertical.name}`}
                            onClick={() => setEditing({ kind: 'vertical', id: vertical.id })}
                          />
                          <StatusToggle
                            active={vertical.isActive}
                            busy={busyKey === `vertical:${vertical.id}`}
                            onClick={() => void toggleVertical(vertical)}
                          >
                            {vertical.isActive ? 'Desactivar' : 'Activar'}
                          </StatusToggle>
                        </span>
                      }
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-stone-900">
                            {vertical.name}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[11px] text-stone-500">
                            /{vertical.slug}
                          </span>
                        </span>
                        <span className="shrink-0">
                          <Badge tone={vertical.isActive ? 'success' : 'neutral'}>
                            {vertical.isActive ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </span>
                      </span>
                      <span className="mt-2 flex items-center gap-2 text-[11px] text-stone-500">
                        <Badge tone="outline">
                          {count === undefined ? '…' : `${count} categorías`}
                        </Badge>
                      </span>
                    </ListItemButton>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          labelledBy="panel-categorias"
          title="Categorías"
          subtitle={
            selectedVertical ? `Dentro de ${selectedVertical.name}` : 'Selecciona una vertical'
          }
          count={selectedVertical ? categories.length : null}
          actions={
            <button
              type="button"
              className={buttonStyles('secondary', 'sm')}
              onClick={() => openModal('category')}
              disabled={!selectedVertical}
            >
              Crear
            </button>
          }
        >
          <SearchField
            id="search-categorias"
            label="Buscar categorías"
            value={categoryQuery}
            onChange={setCategoryQuery}
            placeholder="Buscar por nombre, slug o padre"
            disabled={!selectedVertical || categories.length === 0}
          />

          {!selectedVertical ? (
            <EmptyState
              title="Selecciona una vertical"
              description="Elige una vertical de la primera columna para ver y crear sus categorías."
            />
          ) : loadingCategories ? (
            <SkeletonList rows={3} />
          ) : categories.length === 0 ? (
            <EmptyState
              title="Esta vertical no tiene categorías"
              description={`Crea la primera categoría de ${selectedVertical.name}.`}
              action={
                <button
                  type="button"
                  className={buttonStyles('primary', 'sm')}
                  onClick={() => openModal('category')}
                >
                  Crear categoría
                </button>
              }
            />
          ) : filteredCategories.length === 0 ? (
            <EmptyState
              title="Sin coincidencias"
              description={`No hay categorías que coincidan con «${categoryQuery}».`}
            />
          ) : (
            <ul className="space-y-2 lg:max-h-[26rem] lg:overflow-y-auto lg:pr-1">
              {filteredCategories.map((category) => {
                const parent = category.parentId
                  ? categories.find((item) => item.id === category.parentId)
                  : undefined;
                const count = attributeCounts[category.id];
                return (
                  <li key={category.id} className="min-w-0">
                    <ListItemButton
                      selected={category.id === selectedCategoryId}
                      onClick={() => void selectCategory(category)}
                      action={
                        <span className="flex items-center gap-1">
                          <EditButton
                            label={`Editar ${category.name}`}
                            onClick={() => setEditing({ kind: 'category', id: category.id })}
                          />
                          <StatusToggle
                            active={category.isActive}
                            busy={busyKey === `category:${category.id}`}
                            onClick={() => void toggleCategory(category)}
                          >
                            {category.isActive ? 'Desactivar' : 'Activar'}
                          </StatusToggle>
                        </span>
                      }
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-stone-900">
                            {category.name}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[11px] text-stone-500">
                            /{category.slug}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <Badge tone="outline">
                            {count === undefined ? '…' : `${count} atrib.`}
                          </Badge>
                          {category.isActive ? null : <Badge tone="warning">Inactiva</Badge>}
                        </span>{' '}
                      </span>
                      {parent ? (
                        <span className="mt-2 block truncate text-[11px] text-stone-500">
                          Dentro de {parent.name}
                        </span>
                      ) : null}
                    </ListItemButton>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          labelledBy="panel-atributos"
          title="Atributos"
          subtitle={selectedCategory ? `En ${selectedCategory.name}` : 'Selecciona una categoría'}
          count={selectedCategory ? attributes.length : null}
          actions={
            <button
              type="button"
              className={buttonStyles('secondary', 'sm')}
              onClick={() => openModal('attribute')}
              disabled={!selectedCategory}
            >
              Crear
            </button>
          }
        >
          <SearchField
            id="search-atributos"
            label="Buscar atributos"
            value={attributeQuery}
            onChange={setAttributeQuery}
            placeholder="Buscar por nombre o code"
            disabled={!selectedCategory || attributes.length === 0}
          />

          {!selectedCategory ? (
            <EmptyState
              title="Selecciona una categoría"
              description="Elige una categoría de la segunda columna para ver sus atributos."
            />
          ) : loadingAttributes ? (
            <SkeletonList rows={3} />
          ) : attributes.length === 0 ? (
            <EmptyState
              title="Esta categoría no tiene atributos"
              description={`Define los datos que se pedirán en ${selectedCategory.name}.`}
              action={
                <button
                  type="button"
                  className={buttonStyles('primary', 'sm')}
                  onClick={() => openModal('attribute')}
                >
                  Crear atributo
                </button>
              }
            />
          ) : filteredAttributes.length === 0 ? (
            <EmptyState
              title="Sin coincidencias"
              description={`No hay atributos que coincidan con «${attributeQuery}».`}
            />
          ) : (
            <ul className="space-y-2 lg:max-h-[26rem] lg:overflow-y-auto lg:pr-1">
              {filteredAttributes.map((attribute) => (
                <li
                  key={attribute.id}
                  className={cx(
                    'min-w-0 rounded-xl border bg-white p-3 shadow-sm',
                    attribute.isActive ? 'border-stone-200' : 'border-amber-200 bg-amber-50/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-900">
                        {attribute.name}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-stone-500">
                        {attribute.code}
                      </p>
                    </div>
                    <Badge tone="brand">{ATTRIBUTE_TYPE_LABELS[attribute.type]}</Badge>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone={attribute.isRequired ? 'warning' : 'neutral'}>
                      {attribute.isRequired ? 'Obligatorio' : 'Opcional'}
                    </Badge>
                    <Badge tone={attribute.isFilterable ? 'success' : 'neutral'}>
                      {attribute.isFilterable ? 'Filtrable' : 'No filtrable'}
                    </Badge>
                    {attribute.isActive ? null : <Badge tone="warning">Inactivo</Badge>}
                    <span className="ml-auto flex items-center gap-1">
                      <EditButton
                        label={`Editar ${attribute.name}`}
                        onClick={() => setEditing({ kind: 'attribute', id: attribute.id })}
                      />
                      <StatusToggle
                        active={attribute.isActive}
                        busy={busyKey === `attribute:${attribute.id}`}
                        onClick={() => void toggleAttribute(attribute)}
                      >
                        {attribute.isActive ? 'Desactivar' : 'Activar'}
                      </StatusToggle>
                    </span>
                  </div>

                  {attribute.type === 'ENUM' ? (
                    <div className="mt-2.5 border-t border-stone-100 pt-2">
                      <p className="text-[11px] font-medium text-stone-500">
                        {attribute.options.length}{' '}
                        {attribute.options.length === 1 ? 'opción' : 'opciones'} · pulsa una para
                        activarla o desactivarla
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {attribute.options.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            disabled={busyKey === `option:${option.id}`}
                            onClick={() => void toggleOption(attribute, option)}
                            aria-pressed={option.isActive}
                            title={
                              option.isActive
                                ? `Desactivar «${option.value}»`
                                : `Activar «${option.value}»`
                            }
                            className={cx(
                              'rounded-full border px-2 py-0.5 text-[11px] transition',
                              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700',
                              option.isActive
                                ? 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
                                : 'border-amber-300 bg-amber-50 text-amber-900 line-through hover:bg-amber-100',
                              busyKey === `option:${option.id}` && 'cursor-progress opacity-60',
                            )}
                          >
                            {option.value}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {editing?.kind === 'vertical'
        ? (() => {
            const target = verticals.find((item) => item.id === editing.id);
            return target ? (
              <VerticalEditForm
                vertical={target}
                onCancel={() => setEditing(null)}
                onSave={(name) => saveVerticalEdit(target.id, name)}
              />
            ) : null;
          })()
        : null}

      {editing?.kind === 'category'
        ? (() => {
            const target = categories.find((item) => item.id === editing.id);
            return target ? (
              <CategoryEditForm
                category={target}
                onCancel={() => setEditing(null)}
                onSave={(name) => saveCategoryEdit(target.id, name)}
              />
            ) : null;
          })()
        : null}

      {editing?.kind === 'attribute'
        ? (() => {
            const target = attributes.find((item) => item.id === editing.id);
            return target ? (
              <AttributeEditForm
                attribute={target}
                onCancel={() => setEditing(null)}
                onSave={(payload) => saveAttributeEdit(target, payload)}
                onToggleOption={async (optionId, isActive) => {
                  const option = target.options.find((entry) => entry.id === optionId);
                  if (!option) return 'No encontramos esa opción.';
                  await toggleOption(target, { ...option, isActive: !isActive });
                  return null;
                }}
                onAddOption={(value) => addAttributeOption(target, value)}
              />
            ) : null;
          })()
        : null}

      {modal === 'vertical' ? (
        <VerticalForm onCancel={closeModal} onCreate={handleCreateVertical} />
      ) : null}

      {modal === 'category' ? (
        <CategoryForm
          verticalName={selectedVertical?.name ?? null}
          categories={categories}
          onCancel={closeModal}
          onCreate={handleCreateCategory}
        />
      ) : null}

      {modal === 'attribute' ? (
        <AttributeForm
          categoryName={selectedCategory?.name ?? null}
          onCancel={closeModal}
          onCreate={handleCreateAttribute}
        />
      ) : null}
    </div>
  );
}
