'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
import { ApiError, getJson } from '../../../src/lib/api';
import type { MyBusiness } from '../../../src/lib/business';
import {
  CONDITIONS,
  LISTING_CONDITION_LABELS,
  LISTING_STATUS_LABELS,
  STATUS_TONES,
  archiveListing,
  createListing,
  fetchCategoryAttributes,
  fetchGlobalCategories,
  fetchMyListings,
  fetchOwnCategories,
  formatPrice,
  isPublishable,
  listingStateHint,
  publishListing,
  removeListingImage,
  reorderListingImages,
  sellListing,
  setListingFeatured,
  updateListing,
  uploadListingImage,
  type AttributeDefinition,
  type Listing,
  type ListingAttributeValue,
  type ListingCondition,
  type ListingLimits,
  type ListingStatus,
  type UsableCategory,
} from '../../../src/lib/listings';

const PAGE_SIZE = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 6;

const ERROR_MESSAGES: Record<string, string> = {
  LISTING_LIMIT_REACHED:
    'Tu plan no permite más publicaciones activas. Archiva una para liberar cupo.',
  FEATURED_LIMIT_REACHED: 'No te quedan destacados disponibles. Quita uno antes de destacar otro.',
  LISTING_LOCKED: 'Esta publicación ya no admite cambios porque está vendida o archivada.',
  INVALID_STATUS_TRANSITION: 'Ese cambio de estado no es válido para la publicación.',
  INVALID_ATTRIBUTES: 'Revisa los atributos obligatorios de la categoría.',
  CATEGORY_NOT_AVAILABLE: 'La categoría no está disponible para tu negocio.',
  CATEGORY_NOT_IN_VERTICAL: 'Esa categoría pertenece a otra vertical.',
  IMAGE_LIMIT_REACHED: `Máximo ${MAX_IMAGES} imágenes por publicación.`,
  INVALID_IMAGE_TYPE: 'El archivo debe ser una imagen JPEG, PNG o WebP real.',
  IMAGE_TOO_LARGE: 'La imagen supera los 5 MB permitidos.',
};

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return ERROR_MESSAGES[error.code ?? ''] ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'No se pudo completar la operación';
}

interface ListingFormState {
  categoryId: string;
  title: string;
  description: string;
  condition: ListingCondition;
  price: string;
  attributes: Record<string, ListingAttributeValue>;
}

const EMPTY_FORM: ListingFormState = {
  categoryId: '',
  title: '',
  description: '',
  condition: 'GOOD',
  price: '',
  attributes: {},
};

export default function InventarioPage(): React.ReactElement {
  const router = useRouter();

  const [business, setBusiness] = useState<MyBusiness | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [limits, setLimits] = useState<ListingLimits | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState<ListingStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [globalCategories, setGlobalCategories] = useState<UsableCategory[]>([]);
  const [ownCategories, setOwnCategories] = useState<UsableCategory[]>([]);

  const [loading, setLoading] = useState(true);
  const [listBusy, setListBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [form, setForm] = useState<ListingFormState>(EMPTY_FORM);
  const [definitions, setDefinitions] = useState<AttributeDefinition[]>([]);
  const [definitionsBusy, setDefinitionsBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadListings = useCallback(
    async (options: { page?: number; silent?: boolean } = {}) => {
      const nextPage = options.page ?? 1;
      if (!options.silent) setListBusy(true);
      try {
        const data = await fetchMyListings({
          status: statusFilter || undefined,
          categoryId: categoryFilter || undefined,
          search: search || undefined,
          page: nextPage,
          limit: PAGE_SIZE,
        });
        setListings(data.items);
        setLimits(data.limits);
        setPage(data.page);
        setTotalPages(Math.max(1, data.totalPages));
        setTotal(data.total);
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/login');
          return;
        }
        if (cause instanceof ApiError && cause.status === 404) {
          router.replace('/dashboard/onboarding');
          return;
        }
        setError(describeError(cause));
      } finally {
        setListBusy(false);
      }
    },
    [categoryFilter, router, search, statusFilter],
  );

  useEffect(() => {
    let active = true;
    async function boot(): Promise<void> {
      try {
        await getJson('/auth/me');
      } catch {
        router.replace('/login');
        return;
      }

      let context: MyBusiness;
      try {
        context = await getJson<MyBusiness>('/businesses/me');
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 404) {
          router.replace('/dashboard/onboarding');
          return;
        }
        if (active) setError(describeError(cause));
        return;
      }
      if (!active) return;
      setBusiness(context);

      try {
        const [globalList, ownList] = await Promise.all([
          fetchGlobalCategories(context.business.verticalId),
          fetchOwnCategories(),
        ]);
        if (!active) return;
        setGlobalCategories(globalList);
        setOwnCategories(ownList.filter((category) => category.id));
      } catch (cause) {
        if (active) setError(describeError(cause));
      }

      if (active) setLoading(false);
    }

    void Promise.resolve().then(boot);
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (loading) return;
    void Promise.resolve().then(() => loadListings({ page: 1 }));
    // Se recarga al cambiar filtros o búsqueda; `loadListings` ya los captura.
  }, [loading, loadListings, statusFilter, categoryFilter, search]);

  const categories = useMemo(
    () => [...globalCategories, ...ownCategories],
    [globalCategories, ownCategories],
  );

  const counts = useMemo(() => {
    const byStatus = { DRAFT: 0, PUBLISHED: 0, SOLD: 0, ARCHIVED: 0 };
    for (const listing of listings) byStatus[listing.status] += 1;
    return byStatus;
  }, [listings]);

  async function openCreate(): Promise<void> {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDefinitions([]);
    setFormError(null);
    setFormOpen(true);
  }

  async function openEdit(listing: Listing): Promise<void> {
    setEditing(listing);
    setForm({
      categoryId: listing.categoryId,
      title: listing.title,
      description: listing.description,
      condition: listing.condition,
      price: String(listing.priceCop),
      attributes: { ...listing.attributes },
    });
    setFormError(null);
    setFormOpen(true);
    await loadDefinitions(listing.categoryId, categories);
  }

  async function loadDefinitions(categoryId: string, source: UsableCategory[]): Promise<void> {
    const category = source.find((item) => item.id === categoryId);
    if (!category || category.isOwn) {
      setDefinitions([]);
      return;
    }
    setDefinitionsBusy(true);
    try {
      setDefinitions(await fetchCategoryAttributes(categoryId));
    } catch {
      setDefinitions([]);
    } finally {
      setDefinitionsBusy(false);
    }
  }

  async function onCategoryChange(categoryId: string): Promise<void> {
    setForm((current) => ({ ...current, categoryId, attributes: {} }));
    await loadDefinitions(categoryId, categories);
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    const priceCop = Number.parseInt(form.price, 10);
    if (!Number.isInteger(priceCop) || priceCop < 0) {
      setFormError('El precio debe ser un número entero en pesos.');
      setSaving(false);
      return;
    }

    const payload = {
      categoryId: form.categoryId,
      title: form.title,
      description: form.description,
      condition: form.condition,
      priceCop,
      attributes: form.attributes,
    };

    try {
      if (editing) {
        await updateListing(editing.id, payload);
        setNotice('Publicación actualizada');
      } else {
        await createListing(payload);
        setNotice('Borrador creado. Añade imágenes y publícalo.');
      }
      setFormOpen(false);
      await loadListings({ page: editing ? page : 1 });
      if (!editing) setPage(1);
    } catch (cause) {
      setFormError(describeError(cause));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(
    listing: Listing,
    action: 'publish' | 'sell' | 'archive',
  ): Promise<void> {
    setBusyId(listing.id);
    setError(null);
    try {
      if (action === 'publish') {
        if (!isPublishable(listing)) {
          setError('Añade al menos una imagen antes de publicar.');
          return;
        }
        await publishListing(listing.id);
        setNotice('Publicación visible en el catálogo');
      } else if (action === 'sell') {
        await sellListing(listing.id);
        setNotice('Publicación marcada como vendida');
      } else {
        await archiveListing(listing.id);
        setNotice('Publicación archivada (irreversible)');
      }
      await loadListings({ page, silent: true });
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleFeatured(listing: Listing): Promise<void> {
    setBusyId(listing.id);
    setError(null);
    try {
      await setListingFeatured(listing.id, !listing.featured);
      setNotice(listing.featured ? 'Destacado retirado' : 'Publicación destacada');
      await loadListings({ page, silent: true });
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function refreshListing(listingId: string): Promise<void> {
    const data = await fetchMyListings({ page, limit: PAGE_SIZE });
    const updated = data.items.find((item) => item.id === listingId) ?? null;
    if (updated) setEditing(updated);
    setListings(data.items);
    setLimits(data.limits);
  }

  function setAttribute(code: string, value: ListingAttributeValue): void {
    setForm((current) => ({ ...current, attributes: { ...current.attributes, [code]: value } }));
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <SkeletonList rows={4} />
      </div>
    );
  }

  const quotaFull = limits ? limits.used >= limits.maxListings : false;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <nav aria-label="Ruta de navegación" className="text-xs text-stone-500">
        <Link href="/dashboard" className="hover:text-brand-700">
          Panel
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-stone-700">Inventario</span>
      </nav>

      <header className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            Inventario
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">
            {business?.business.name ?? 'Tu negocio'} · publica, destaca y archiva tus artículos.
          </p>
        </div>
        <button type="button" onClick={openCreate} className={buttonStyles('primary')}>
          Nuevo artículo
        </button>
      </header>

      {notice ? (
        <div className="mt-4">
          <Banner tone="success" message={notice} onDismiss={() => setNotice(null)} />
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <Banner tone="error" message={error} onDismiss={() => setError(null)} />
        </div>
      ) : null}

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen">
        <StatCard label="Publicados" value={counts.PUBLISHED} hint="Visibles en el catálogo" />
        <StatCard label="Borradores" value={counts.DRAFT} hint="Solo visibles para ti" />
        <StatCard label="Vendidos" value={counts.SOLD} hint="Se conservan como historial" />
        <StatCard
          label="Cupo"
          value={limits ? `${limits.used} / ${limits.maxListings}` : '—'}
          hint={quotaFull ? 'Sin cupo disponible' : 'Publicaciones usadas'}
        />
      </section>

      {limits ? (
        <p className="mt-3 text-xs text-stone-500">
          Destacados en uso: <strong>{limits.featuredUsed}</strong> de {limits.featuredSlots}.
          {quotaFull
            ? ' Archiva una publicación para liberar cupo o mejora tu plan.'
            : ' Los destacados se liberan al archivar o vender.'}
        </p>
      ) : null}

      <section className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-end" aria-label="Filtros">
        <div className="lg:w-72">
          <SearchField
            id="listing-search"
            label="Buscar por título"
            value={searchInput}
            placeholder="Ej. iPhone 13"
            onChange={setSearchInput}
          />
        </div>
        <button
          type="button"
          className={buttonStyles('secondary', 'sm')}
          onClick={() => {
            setSearch(searchInput.trim());
            setPage(1);
          }}
        >
          Buscar
        </button>
        <label className="text-sm text-stone-700">
          <span className="mb-1 block text-xs font-medium text-stone-600">Estado</span>
          <select
            className={inputStyles}
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as ListingStatus | '');
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            <option value="DRAFT">Borradores</option>
            <option value="PUBLISHED">Publicados</option>
            <option value="SOLD">Vendidos</option>
            <option value="ARCHIVED">Archivados</option>
          </select>
        </label>
        <label className="text-sm text-stone-700">
          <span className="mb-1 block text-xs font-medium text-stone-600">Categoría</span>
          <select
            className={inputStyles}
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.isOwn ? ' (propia)' : ''}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="mt-5" aria-label="Publicaciones">
        {listBusy ? (
          <SkeletonList rows={5} />
        ) : listings.length === 0 ? (
          <EmptyState
            title="Todavía no hay publicaciones"
            description="Crea un borrador, súbele fotos y publícalo para que aparezca en el catálogo de tu vertical."
            action={
              <button type="button" onClick={openCreate} className={buttonStyles('primary', 'sm')}>
                Crear el primer artículo
              </button>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl border border-stone-200 bg-white lg:block">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Artículo</th>
                    <th className="px-4 py-3 font-medium">Categoría</th>
                    <th className="px-4 py-3 font-medium">Precio</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {listings.map((listing) => (
                    <tr key={listing.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          {listing.images[0] ? (
                            <img
                              src={listing.images[0].url}
                              alt={listing.title}
                              width={48}
                              height={48}
                              className="h-12 w-12 rounded-lg border border-stone-200 object-cover"
                            />
                          ) : (
                            <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-stone-300 text-[10px] text-stone-400">
                              Sin imagen
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-stone-900">{listing.title}</p>
                            <p className="mt-0.5 text-xs text-stone-500">
                              {listing.images.length} imagen(es) ·{' '}
                              {LISTING_CONDITION_LABELS[listing.condition]}
                            </p>
                            {listing.featured ? (
                              <span className="mt-1 inline-block">
                                <Badge tone="brand">Destacado</Badge>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-600">{listing.categoryName}</td>
                      <td className="px-4 py-3 font-medium text-stone-900">
                        {formatPrice(listing.priceCop, listing.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONES[listing.status]}>
                          {LISTING_STATUS_LABELS[listing.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <ListingActions
                          listing={listing}
                          busy={busyId === listing.id}
                          onEdit={() => void openEdit(listing)}
                          onAction={runAction}
                          onFeature={toggleFeatured}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 lg:hidden">
              {listings.map((listing) => (
                <li key={listing.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex items-start gap-3">
                    {listing.images[0] ? (
                      <img
                        src={listing.images[0].url}
                        alt={listing.title}
                        width={64}
                        height={64}
                        className="h-16 w-16 rounded-lg border border-stone-200 object-cover"
                      />
                    ) : (
                      <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-stone-300 text-[10px] text-stone-400">
                        Sin imagen
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-stone-900">{listing.title}</p>
                      <p className="text-xs text-stone-500">{listing.categoryName}</p>
                      <p className="mt-1 text-sm font-medium text-stone-900">
                        {formatPrice(listing.priceCop, listing.currency)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone={STATUS_TONES[listing.status]}>
                          {LISTING_STATUS_LABELS[listing.status]}
                        </Badge>
                        {listing.featured ? <Badge tone="brand">Destacado</Badge> : null}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-stone-500">
                    {listingStateHint(listing.status, listing.featured)}
                  </p>
                  <div className="mt-3">
                    <ListingActions
                      listing={listing}
                      busy={busyId === listing.id}
                      onEdit={() => void openEdit(listing)}
                      onAction={runAction}
                      onFeature={toggleFeatured}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-col items-center justify-between gap-2 text-xs text-stone-500 sm:flex-row">
              <span>
                {total} publicación(es) · página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={buttonStyles('secondary', 'sm')}
                  disabled={page <= 1 || listBusy}
                  onClick={() => void loadListings({ page: page - 1 })}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className={buttonStyles('secondary', 'sm')}
                  disabled={page >= totalPages || listBusy}
                  onClick={() => void loadListings({ page: page + 1 })}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <Modal
        open={formOpen}
        title={editing ? 'Editar publicación' : 'Nuevo artículo'}
        description={
          editing
            ? 'Los cambios no se publican solos: la publicación conserva su estado.'
            : 'Se crea como borrador. Podrás publicarlo cuando tenga imágenes.'
        }
        onClose={() => setFormOpen(false)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={buttonStyles('secondary', 'sm')}
              onClick={() => setFormOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="listing-form"
              className={buttonStyles('primary', 'sm')}
              disabled={saving}
            >
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear borrador'}
            </button>
          </div>
        }
      >
        <form id="listing-form" className="space-y-4" onSubmit={(event) => void submitForm(event)}>
          {formError ? (
            <Banner tone="error" message={formError} onDismiss={() => setFormError(null)} />
          ) : null}

          <Field id="listing-category" label="Categoría" hint="Solo categorías de tu vertical">
            <select
              id="listing-category"
              className={inputStyles}
              value={form.categoryId}
              required
              onChange={(event) => void onCategoryChange(event.target.value)}
            >
              <option value="">Selecciona una categoría</option>
              <optgroup label="Catálogo global">
                {globalCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </optgroup>
              {ownCategories.length > 0 ? (
                <optgroup label="Mis categorías">
                  {ownCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </Field>

          <Field id="listing-title" label="Título" hint="Entre 5 y 120 caracteres">
            <input
              id="listing-title"
              className={inputStyles}
              value={form.title}
              minLength={5}
              maxLength={120}
              required
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
            />
          </Field>

          <Field id="listing-description" label="Descripción" hint="Entre 20 y 4000 caracteres">
            <textarea
              id="listing-description"
              className={cx(inputStyles, 'min-h-[7rem]')}
              value={form.description}
              minLength={20}
              maxLength={4000}
              required
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="listing-condition" label="Condición">
              <select
                id="listing-condition"
                className={inputStyles}
                value={form.condition}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    condition: event.target.value as ListingCondition,
                  }))
                }
              >
                {CONDITIONS.map((condition) => (
                  <option key={condition} value={condition}>
                    {LISTING_CONDITION_LABELS[condition]}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="listing-price" label="Precio (COP)">
              <input
                id="listing-price"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                className={inputStyles}
                value={form.price}
                required
                onChange={(event) =>
                  setForm((current) => ({ ...current, price: event.target.value }))
                }
              />
            </Field>
          </div>

          {definitionsBusy ? (
            <p className="text-xs text-stone-500">Cargando atributos de la categoría…</p>
          ) : definitions.length > 0 ? (
            <fieldset className="space-y-3 rounded-lg border border-stone-200 bg-stone-50/60 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
                Atributos de la categoría
              </legend>
              {definitions.map((definition) => (
                <AttributeField
                  key={definition.id}
                  definition={definition}
                  value={form.attributes[definition.code]}
                  onChange={(value) => setAttribute(definition.code, value)}
                />
              ))}
            </fieldset>
          ) : form.categoryId ? (
            <p className="text-xs text-stone-500">
              Esta categoría no tiene atributos configurados.
            </p>
          ) : null}

          {editing ? (
            <ImageManager
              listing={editing}
              onChanged={() => void refreshListing(editing.id)}
              onError={(message) => setError(message)}
            />
          ) : (
            <p className="text-xs text-stone-500">
              Guarda el borrador para poder subir hasta {MAX_IMAGES} imágenes de 5 MB.
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
}

function ListingActions({
  listing,
  busy,
  onEdit,
  onAction,
  onFeature,
}: {
  listing: Listing;
  busy: boolean;
  onEdit: () => void;
  onAction: (listing: Listing, action: 'publish' | 'sell' | 'archive') => Promise<void>;
  onFeature: (listing: Listing) => Promise<void>;
}): React.ReactElement {
  const editable = listing.status === 'DRAFT' || listing.status === 'PUBLISHED';
  return (
    <div className="flex flex-wrap gap-2">
      {editable ? (
        <button type="button" className={buttonStyles('secondary', 'sm')} onClick={onEdit}>
          Editar
        </button>
      ) : null}
      {listing.status === 'DRAFT' ? (
        <button
          type="button"
          className={buttonStyles('primary', 'sm')}
          disabled={busy}
          onClick={() => void onAction(listing, 'publish')}
        >
          Publicar
        </button>
      ) : null}
      {listing.status === 'PUBLISHED' ? (
        <>
          <button
            type="button"
            className={buttonStyles('secondary', 'sm')}
            disabled={busy}
            onClick={() => void onFeature(listing)}
          >
            {listing.featured ? 'Quitar destacado' : 'Destacar'}
          </button>
          <button
            type="button"
            className={buttonStyles('secondary', 'sm')}
            disabled={busy}
            onClick={() => void onAction(listing, 'sell')}
          >
            Vender
          </button>
        </>
      ) : null}
      {listing.status !== 'ARCHIVED' ? (
        <button
          type="button"
          className={buttonStyles('ghost', 'sm')}
          disabled={busy}
          onClick={() => void onAction(listing, 'archive')}
        >
          Archivar
        </button>
      ) : null}
    </div>
  );
}

function AttributeField({
  definition,
  value,
  onChange,
}: {
  definition: AttributeDefinition;
  value: ListingAttributeValue | undefined;
  onChange: (value: ListingAttributeValue) => void;
}): React.ReactElement {
  const id = `attribute-${definition.code}`;
  const label = `${definition.name}${definition.isRequired ? ' *' : ''}`;

  if (definition.type === 'BOOLEAN') {
    return (
      <label htmlFor={id} className="flex items-center gap-2 text-sm text-stone-700">
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 rounded border-stone-300 text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
        />
        {label}
      </label>
    );
  }

  if (definition.type === 'ENUM') {
    return (
      <Field id={id} label={label}>
        <select
          id={id}
          className={inputStyles}
          value={typeof value === 'string' ? value : ''}
          required={definition.isRequired}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Selecciona…</option>
          {(definition.options ?? []).map((option) => (
            <option key={option.id} value={option.value}>
              {option.value}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  return (
    <Field id={id} label={label}>
      <input
        id={id}
        type={definition.type === 'NUMBER' ? 'number' : 'text'}
        className={inputStyles}
        value={value === undefined ? '' : String(value)}
        required={definition.isRequired}
        onChange={(event) =>
          onChange(definition.type === 'NUMBER' ? Number(event.target.value) : event.target.value)
        }
      />
    </Field>
  );
}

function ImageManager({
  listing,
  onChanged,
  onError,
}: {
  listing: Listing;
  onChanged: () => void;
  onError: (message: string) => void;
}): React.ReactElement {
  const [uploading, setUploading] = useState(false);
  const [busyImage, setBusyImage] = useState<string | null>(null);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      onError('La imagen supera los 5 MB permitidos.');
      return;
    }
    setUploading(true);
    try {
      await uploadListingImage(listing.id, file);
      onChanged();
    } catch (cause) {
      onError(describeError(cause));
    } finally {
      setUploading(false);
    }
  }

  async function remove(imageId: string): Promise<void> {
    setBusyImage(imageId);
    try {
      await removeListingImage(listing.id, imageId);
      onChanged();
    } catch (cause) {
      onError(describeError(cause));
    } finally {
      setBusyImage(null);
    }
  }

  async function move(imageId: string, direction: -1 | 1): Promise<void> {
    const ids = listing.images.map((image) => image.id);
    const index = ids.indexOf(imageId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const next = [...ids];
    const moving = next[index];
    const displaced = next[target];
    if (!moving || !displaced) return;
    next[index] = displaced;
    next[target] = moving;
    setBusyImage(imageId);
    try {
      await reorderListingImages(listing.id, next);
      onChanged();
    } catch (cause) {
      onError(describeError(cause));
    } finally {
      setBusyImage(null);
    }
  }

  return (
    <fieldset className="space-y-3 rounded-lg border border-stone-200 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
        Imágenes ({listing.images.length}/{MAX_IMAGES})
      </legend>

      {listing.images.length === 0 ? (
        <p className="text-xs text-stone-500">
          Sube al menos una imagen para poder publicar. JPEG, PNG o WebP de hasta 5 MB.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {listing.images.map((image, index) => (
            <li key={image.id} className="rounded-lg border border-stone-200 p-2">
              <img
                src={image.url}
                alt={`Imagen ${index + 1} de ${listing.title}`}
                width={160}
                height={120}
                className="h-24 w-full rounded object-cover"
              />
              <div className="mt-2 flex items-center justify-between gap-1">
                <span className="text-[11px] text-stone-500">
                  {image.width && image.height ? `${image.width}×${image.height}` : 'Imagen'}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label="Subir imagen"
                    className={buttonStyles('ghost', 'sm')}
                    disabled={index === 0 || busyImage !== null}
                    onClick={() => void move(image.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Bajar imagen"
                    className={buttonStyles('ghost', 'sm')}
                    disabled={index === listing.images.length - 1 || busyImage !== null}
                    onClick={() => void move(image.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label="Eliminar imagen"
                    className={buttonStyles('ghost', 'sm')}
                    disabled={busyImage !== null}
                    onClick={() => void remove(image.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {listing.images.length < MAX_IMAGES ? (
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-brand-700">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={(event) => void onFile(event)}
          />
          <span className={buttonStyles('secondary', 'sm')}>
            {uploading ? 'Subiendo…' : 'Añadir imagen'}
          </span>
        </label>
      ) : null}
    </fieldset>
  );
}
