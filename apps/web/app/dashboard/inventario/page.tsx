'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Badge,
  Banner,
  EmptyState,
  SearchField,
  SkeletonList,
  StatCard,
  buttonStyles,
  inputStyles,
} from '../../../src/components/taxonomy-ui';
import { ApiError, getJson } from '../../../src/lib/api';
import type { MyBusiness } from '../../../src/lib/business';
import {
  LISTING_CONDITION_LABELS,
  LISTING_STATUS_LABELS,
  MIN_PUBLISH_IMAGES,
  STATUS_TONES,
  archiveListing,
  fetchGlobalCategories,
  fetchMyListings,
  fetchOwnCategories,
  formatPrice,
  isPublishable,
  listingStateHint,
  publishListing,
  sellListing,
  setListingFeatured,
  type Listing,
  type ListingLimits,
  type ListingStatus,
  type UsableCategory,
} from '../../../src/lib/listings';
import { ListingFormModal } from './listing-form';

const PAGE_SIZE = 10;
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
  IMAGES_REQUIRED: `Necesitas mínimo ${MIN_PUBLISH_IMAGES} fotos para publicar.`,
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

  function openCreate(): void {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(listing: Listing): void {
    setEditing(listing);
    setFormOpen(true);
  }

  async function onFormSaved(mode: 'created' | 'updated'): Promise<void> {
    setNotice(
      mode === 'created'
        ? 'Borrador creado. Súbele fotos para publicarlo.'
        : 'Publicación actualizada',
    );
    setFormOpen(false);
    setEditing(null);
    await loadListings({ page: mode === 'created' ? 1 : page, silent: true });
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
          setError(`Necesitas mínimo ${MIN_PUBLISH_IMAGES} fotos para publicar.`);
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
                        {formatPrice(listing.priceAmount, listing.currency)}
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
                        {formatPrice(listing.priceAmount, listing.currency)}
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
      {formOpen ? (
        <ListingFormModal
          key={editing?.id ?? 'new'}
          listing={editing}
          globalCategories={globalCategories}
          ownCategories={ownCategories}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
            void loadListings({ page, silent: true });
          }}
          onSaved={(mode) => void onFormSaved(mode)}
          onError={() => undefined}
        />
      ) : null}{' '}
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
