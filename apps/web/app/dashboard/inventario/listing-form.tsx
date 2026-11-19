'use client';

import { useEffect, useMemo, useState } from 'react';

import { Modal } from '../../../src/components/modal';
import { Banner, Field, buttonStyles, cx, inputStyles } from '../../../src/components/taxonomy-ui';
import { ApiError } from '../../../src/lib/api';
import {
  CONDITIONS,
  CURRENCY_LABELS,
  LISTING_CONDITION_LABELS,
  MAX_IMAGES,
  MIN_PUBLISH_IMAGES,
  MIN_PUBLISH_IMAGES_LABEL,
  createListing,
  fetchCategoryAttributes,
  removeListingImage,
  reorderListingImages,
  updateListing,
  uploadListingImage,
  type AttributeDefinition,
  type Listing,
  type ListingAttributeValue,
  type Currency,
  type ListingCondition,
  type ListingImage,
  type UsableCategory,
} from '../../../src/lib/listings';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';

const ERROR_MESSAGES: Record<string, string> = {
  LISTING_LIMIT_REACHED:
    'Tu plan no permite más publicaciones activas. Archiva una para liberar cupo.',
  INVALID_ATTRIBUTES: 'Revisa los atributos obligatorios de la categoría.',
  CATEGORY_NOT_AVAILABLE: 'La categoría no está disponible para tu negocio.',
  CATEGORY_NOT_IN_VERTICAL: 'Esa categoría pertenece a otra vertical.',
  IMAGES_REQUIRED: 'Sube al menos una foto antes de publicar.',
  IMAGE_LIMIT_REACHED: `Máximo ${MAX_IMAGES} imágenes por publicación.`,
  INVALID_IMAGE_TYPE: 'El archivo debe ser una imagen JPEG, PNG o WebP real.',
  IMAGE_TOO_LARGE: 'La imagen supera los 5 MB permitidos.',
  LISTING_LOCKED: 'Esta publicación ya no admite cambios porque está vendida o archivada.',
};

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return ERROR_MESSAGES[error.code ?? ''] ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'No se pudo completar la operación';
}

interface FormState {
  categoryId: string;
  title: string;
  description: string;
  condition: ListingCondition;
  price: string;
  currency: Currency;
  attributes: Record<string, ListingAttributeValue>;
}

const EMPTY_FORM: FormState = {
  categoryId: '',
  title: '',
  description: '',
  condition: 'GOOD',
  price: '',
  currency: 'COP',
  attributes: {},
};

function formFromListing(listing: Listing): FormState {
  return {
    categoryId: listing.categoryId,
    title: listing.title,
    description: listing.description,
    condition: listing.condition,
    price: String(listing.priceAmount),
    currency: (listing.currency === 'USD' ? 'USD' : 'COP') as Currency,
    attributes: { ...listing.attributes },
  };
}

export interface ListingFormModalProps {
  /** `null` = alta; con publicación = edición. */
  listing: Listing | null;
  globalCategories: UsableCategory[];
  ownCategories: UsableCategory[];
  onClose: () => void;
  onSaved: (mode: 'created' | 'updated') => void;
  onError: (message: string) => void;
}

/**
 * Formulario de alta y edición de una publicación.
 *
 * Vive en su propio componente a propósito: así el estado de los campos solo
 * re-renderiza este formulario y no la página de inventario completa (lista,
 * filtros, contadores y tabla). La validación de texto ocurre en `onBlur`, no en
 * cada pulsación, para que escribir sea inmediato.
 */
export function ListingFormModal({
  listing,
  globalCategories,
  ownCategories,
  onClose,
  onSaved,
  onError,
}: ListingFormModalProps): React.ReactElement {
  const [form, setForm] = useState<FormState>(() =>
    listing ? formFromListing(listing) : EMPTY_FORM,
  );
  const [definitions, setDefinitions] = useState<AttributeDefinition[]>([]);
  const [definitionsBusy, setDefinitionsBusy] = useState(() => Boolean(listing));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [uploadNote, setUploadNote] = useState<string | null>(null);

  useEffect(() => {
    if (!listing) return;

    const category = [...globalCategories, ...ownCategories].find(
      (item) => item.id === listing.categoryId,
    );
    if (!category || category.isOwn) return;

    let active = true;
    void fetchCategoryAttributes(listing.categoryId)
      .then((items) => {
        if (!active) return;
        setDefinitions(items);
        setDefinitionsBusy(false);
      })
      .catch(() => {
        if (active) setDefinitionsBusy(false);
      });

    return () => {
      active = false;
    };
    // Los atributos dependen de la publicación abierta; el componente se monta de
    // cero por cada apertura (key en el padre), así que no hay que resincronizar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const categoryOptions = useMemo(
    () => ({ global: globalCategories, own: ownCategories }),
    [globalCategories, ownCategories],
  );

  function patch(next: Partial<FormState>): void {
    setForm((current) => ({ ...current, ...next }));
  }

  async function onCategoryChange(categoryId: string): Promise<void> {
    patch({ categoryId, attributes: {} });
    const category = [...categoryOptions.global, ...categoryOptions.own].find(
      (item) => item.id === categoryId,
    );
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

  function validate(): boolean {
    const errors: Record<string, string> = {};
    const title = form.title.trim();
    if (title.length < 5 || title.length > 120) {
      errors.title = 'El título debe tener entre 5 y 120 caracteres.';
    }
    const description = form.description.trim();
    if (description.length < 20 || description.length > 4000) {
      errors.description = 'La descripción debe tener entre 20 y 4000 caracteres.';
    }
    const price = Number.parseInt(form.price, 10);
    if (!Number.isInteger(price) || price < 0) {
      errors.price = 'El precio debe ser un número entero mayor o igual a 0.';
    }
    if (!form.categoryId) errors.categoryId = 'Selecciona una categoría.';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setFormError(null);

    const payload = {
      categoryId: form.categoryId,
      title: form.title.trim(),
      description: form.description.trim(),
      condition: form.condition,
      priceAmount: Number.parseInt(form.price, 10),
      currency: form.currency,
      attributes: form.attributes,
    };

    try {
      if (listing) {
        await updateListing(listing.id, payload);
        onSaved('updated');
      } else {
        const created = await createListing(payload);
        // El borrador nace aquí; las fotos elegidas antes de guardar se suben ahora.
        if (pending.length > 0) {
          let uploaded = 0;
          for (const item of pending) {
            setUploadNote(`Subiendo fotos ${uploaded + 1}/${pending.length}…`);
            try {
              await uploadListingImage(created.id, item.file);
              uploaded += 1;
            } catch (cause) {
              onError(describeError(cause));
            }
          }
          setUploadNote(null);
          if (uploaded < pending.length) {
            onError(
              `Se guardaron ${uploaded} de ${pending.length} fotos. Abre la publicación para completarlas.`,
            );
          }
        }
        onSaved('created');
      }
    } catch (cause) {
      setFormError(describeError(cause));
    } finally {
      setSaving(false);
      setUploadNote(null);
    }
  }

  return (
    <Modal
      open
      title={listing ? 'Editar publicación' : 'Nuevo artículo'}
      description={
        listing
          ? 'Los cambios no se publican solos: la publicación conserva su estado.'
          : `Se crea como borrador. Para publicarlo necesitas ${MIN_PUBLISH_IMAGES_LABEL}.`
      }
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={buttonStyles('secondary', 'sm')} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="listing-form"
            className={buttonStyles('primary', 'sm')}
            disabled={saving}
          >
            {saving ? 'Guardando…' : listing ? 'Guardar cambios' : 'Crear borrador'}
          </button>
        </div>
      }
    >
      <form id="listing-form" className="space-y-4" onSubmit={(event) => void submit(event)}>
        {formError ? (
          <Banner tone="error" message={formError} onDismiss={() => setFormError(null)} />
        ) : null}
        {uploadNote ? <Banner tone="info" message={uploadNote} /> : null}

        <Field
          id="listing-category"
          label="Categoría"
          hint="Solo categorías de tu vertical"
          error={fieldErrors.categoryId}
        >
          <select
            id="listing-category"
            className={inputStyles}
            value={form.categoryId}
            required
            onChange={(event) => void onCategoryChange(event.target.value)}
            onBlur={() => setFieldErrors(({ categoryId: _ignored, ...rest }) => rest)}
          >
            <option value="">Selecciona una categoría</option>
            <optgroup label="Catálogo global">
              {categoryOptions.global.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
            {categoryOptions.own.length > 0 ? (
              <optgroup label="Mis categorías">
                {categoryOptions.own.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </Field>

        <Field
          id="listing-title"
          label="Título"
          hint="Entre 5 y 120 caracteres"
          error={fieldErrors.title}
        >
          <input
            id="listing-title"
            className={inputStyles}
            value={form.title}
            maxLength={120}
            required
            onChange={(event) => patch({ title: event.target.value })}
            onBlur={() =>
              setFieldErrors(({ title: _ignored, ...rest }) => {
                const value = form.title.trim();
                return value.length >= 5
                  ? rest
                  : { ...rest, title: 'El título debe tener entre 5 y 120 caracteres.' };
              })
            }
          />
        </Field>

        <Field
          id="listing-description"
          label="Descripción"
          hint="Entre 20 y 4000 caracteres"
          error={fieldErrors.description}
        >
          <textarea
            id="listing-description"
            className={cx(inputStyles, 'min-h-[7rem]')}
            value={form.description}
            maxLength={4000}
            required
            onChange={(event) => patch({ description: event.target.value })}
            onBlur={() =>
              setFieldErrors(({ description: _ignored, ...rest }) => {
                const value = form.description.trim();
                return value.length >= 20
                  ? rest
                  : {
                      ...rest,
                      description: 'La descripción debe tener entre 20 y 4000 caracteres.',
                    };
              })
            }
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="listing-condition" label="Condición">
            <select
              id="listing-condition"
              className={inputStyles}
              value={form.condition}
              onChange={(event) => patch({ condition: event.target.value as ListingCondition })}
            >
              {CONDITIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {LISTING_CONDITION_LABELS[condition]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="listing-price" label={`Precio (${form.currency})`} error={fieldErrors.price}>
            <input
              id="listing-price"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              className={inputStyles}
              value={form.price}
              required
              onChange={(event) => patch({ price: event.target.value })}
              onBlur={() => {
                const price = Number.parseInt(form.price, 10);
                if (Number.isInteger(price) && price >= 0) {
                  setFieldErrors(({ price: _ignored, ...rest }) => rest);
                }
              }}
            />
          </Field>
          <Field
            id="listing-currency"
            label="Moneda"
            hint="El comprador paga en la moneda que elijas; la plataforma no convierte."
          >
            <select
              id="listing-currency"
              className={inputStyles}
              value={form.currency}
              onChange={(event) => patch({ currency: event.target.value as Currency })}
            >
              <option value="COP">{CURRENCY_LABELS.COP}</option>
              <option value="USD">{CURRENCY_LABELS.USD}</option>
            </select>
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
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    attributes: { ...current.attributes, [definition.code]: value },
                  }))
                }
              />
            ))}
          </fieldset>
        ) : form.categoryId ? (
          <p className="text-xs text-stone-500">Esta categoría no tiene atributos configurados.</p>
        ) : null}

        {listing ? (
          <ImageManager
            listingId={listing.id}
            initialImages={listing.images}
            onError={(message) => {
              setFormError(message);
              onError(message);
            }}
          />
        ) : (
          <PendingImages
            items={pending}
            onChange={setPending}
            onError={(message) => {
              setFormError(message);
              onError(message);
            }}
          />
        )}
      </form>
    </Modal>
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

interface PendingImage {
  file: File;
  preview: string;
}

/**
 * Fotos elegidas antes de que exista el borrador. Se guardan en memoria y se
 * suben en cuanto la publicación se crea, para que el flujo «crear y subir
 * fotos» ocurra en el mismo formulario.
 */
function PendingImages({
  items,
  onChange,
  onError,
}: {
  items: PendingImage[];
  onChange: (next: PendingImage[]) => void;
  onError: (message: string) => void;
}): React.ReactElement {
  const missing = Math.max(0, MIN_PUBLISH_IMAGES - items.length);

  function onFiles(event: React.ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const free = MAX_IMAGES - items.length;
    if (free <= 0) {
      onError(`Máximo ${MAX_IMAGES} fotos por publicación.`);
      return;
    }
    const selected = files.slice(0, free);
    if (files.length > free) {
      onError(`Solo puedes subir ${MAX_IMAGES} fotos por publicación.`);
    }

    const accepted: PendingImage[] = [];
    for (const file of selected) {
      if (file.size > MAX_IMAGE_BYTES) {
        onError(`La imagen ${file.name} supera los 5 MB permitidos.`);
        continue;
      }
      accepted.push({ file, preview: URL.createObjectURL(file) });
    }
    onChange([...items, ...accepted]);
  }

  function remove(index: number): void {
    const target = items[index];
    if (target) URL.revokeObjectURL(target.preview);
    onChange(items.filter((_, position) => position !== index));
  }

  return (
    <fieldset className="space-y-3 rounded-lg border border-stone-200 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
        Fotos ({items.length}/{MAX_IMAGES})
      </legend>

      <p className="text-xs text-stone-600">
        Sube{' '}
        <strong>
          mínimo {MIN_PUBLISH_IMAGES_LABEL}, máximo {MAX_IMAGES}
        </strong>
        . JPEG, PNG o WebP de hasta 5 MB cada una. Se cargan al guardar el borrador.
      </p>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-4 text-center text-xs text-stone-500">
          Aún no hay fotos. La primera será la portada del catálogo.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item, index) => (
            <li key={item.preview} className="overflow-hidden rounded-lg border border-stone-200">
              <div className="relative aspect-square bg-stone-100">
                <img
                  src={item.preview}
                  alt={`Vista previa de ${item.file.name}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {index === 0 ? (
                  <span className="absolute left-1 top-1 rounded bg-stone-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    Portada
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="truncate text-[11px] text-stone-500">{item.file.name}</span>
                <button
                  type="button"
                  className="text-[11px] font-medium text-red-600 hover:underline"
                  onClick={() => remove(index)}
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className={buttonStyles('secondary', 'sm')}>
          {items.length === 0 ? 'Añadir fotos' : 'Añadir más fotos'}
          <input
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            className="sr-only"
            onChange={onFiles}
          />
        </label>
        <span className="text-[11px] text-stone-500">
          {missing > 0
            ? `Te faltan ${missing} ${missing === 1 ? 'foto' : 'fotos'} para poder publicar.`
            : 'Ya tienes las fotos mínimas para publicar.'}
        </span>
      </div>
    </fieldset>
  );
}
function ImageManager({
  listingId,
  initialImages,
  onError,
}: {
  listingId: string;
  initialImages: ListingImage[];
  onError: (message: string) => void;
}): React.ReactElement {
  const [images, setImages] = useState<ListingImage[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [busyImage, setBusyImage] = useState<string | null>(null);

  async function onFiles(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const free = MAX_IMAGES - images.length;
    const selected = files.slice(0, free);
    if (files.length > free) {
      onError(`Solo puedes subir ${MAX_IMAGES} imágenes por publicación.`);
    }

    setUploading(true);
    setProgress({ done: 0, total: selected.length });

    let uploaded = 0;
    for (const file of selected) {
      if (file.size > MAX_IMAGE_BYTES) {
        onError('La imagen supera los 5 MB permitidos.');
        continue;
      }
      try {
        const image = await uploadListingImage(listingId, file);
        setImages((current) => [...current, image]);
        uploaded += 1;
      } catch (cause) {
        onError(describeError(cause));
      } finally {
        setProgress({ done: uploaded, total: selected.length });
      }
    }

    setUploading(false);
  }

  async function remove(imageId: string): Promise<void> {
    setBusyImage(imageId);
    try {
      await removeListingImage(listingId, imageId);
      setImages((current) => current.filter((image) => image.id !== imageId));
    } catch (cause) {
      onError(describeError(cause));
    } finally {
      setBusyImage(null);
    }
  }

  async function move(imageId: string, direction: -1 | 1): Promise<void> {
    const index = images.findIndex((image) => image.id === imageId);
    const target = index + direction;
    const moving = images[index];
    const displaced = images[target];
    if (index < 0 || !moving || !displaced) return;

    const next = [...images];
    next[index] = displaced;
    next[target] = moving;
    setImages(next);
    setBusyImage(imageId);
    try {
      await reorderListingImages(
        listingId,
        next.map((image) => image.id),
      );
    } catch (cause) {
      setImages(images);
      onError(describeError(cause));
    } finally {
      setBusyImage(null);
    }
  }

  const missing = Math.max(0, MIN_PUBLISH_IMAGES - images.length);

  return (
    <fieldset className="space-y-3 rounded-lg border border-stone-200 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
        Fotos ({images.length}/{MAX_IMAGES})
      </legend>

      <p className="text-xs text-stone-600">
        Sube{' '}
        <strong>
          mínimo {MIN_PUBLISH_IMAGES_LABEL}, máximo {MAX_IMAGES}
        </strong>
        . JPEG, PNG o WebP de hasta 5 MB cada una.
      </p>

      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-4 text-center text-xs text-stone-500">
          Aún no hay fotos. La primera será la portada del catálogo.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((image, index) => (
            <li key={image.id} className="rounded-lg border border-stone-200 p-2">
              <img
                src={image.url}
                alt={`Foto ${index + 1}`}
                width={160}
                height={120}
                loading="lazy"
                className="h-24 w-full rounded object-cover"
              />
              <div className="mt-2 flex items-center justify-between gap-1">
                <span className="text-[11px] text-stone-500">
                  {index === 0 ? 'Portada' : `#${index + 1}`}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label="Subir foto"
                    className={buttonStyles('ghost', 'sm')}
                    disabled={index === 0 || busyImage !== null}
                    onClick={() => void move(image.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Bajar foto"
                    className={buttonStyles('ghost', 'sm')}
                    disabled={index === images.length - 1 || busyImage !== null}
                    onClick={() => void move(image.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label="Eliminar foto"
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

      {images.length < MIN_PUBLISH_IMAGES ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Te faltan {missing} {missing === 1 ? 'foto' : 'fotos'} para poder publicar.
        </p>
      ) : (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900">
          Ya tienes las fotos mínimas para publicar.
        </p>
      )}

      {images.length < MAX_IMAGES ? (
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-brand-700">
          <input
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(event) => void onFiles(event)}
          />
          <span className={buttonStyles('secondary', 'sm')}>
            {uploading
              ? `Subiendo ${progress.done}/${progress.total}…`
              : images.length === 0
                ? 'Añadir fotos'
                : 'Añadir más fotos'}
          </span>
        </label>
      ) : null}
    </fieldset>
  );
}
