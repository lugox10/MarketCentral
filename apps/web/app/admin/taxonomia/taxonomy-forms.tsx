'use client';

import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import { Modal } from '../../../src/components/modal';
import {
  ATTRIBUTE_TYPES,
  ATTRIBUTE_TYPE_LABELS,
  type AttributeType,
  type Category,
} from '../../../src/lib/taxonomy';
import { Banner, Field, buttonStyles, cx, inputStyles } from '../../../src/components/taxonomy-ui';

/**
 * Formularios de creación de taxonomía.
 *
 * Cada formulario vive en su propio componente y guarda su estado localmente.
 * Así, escribir en un campo solo vuelve a renderizar el modal y no la tabla,
 * los contadores ni los paneles de la página que lo abre.
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseOptions(raw: string): { options: string[]; error: string | null } {
  const options = raw
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const seen = new Set<string>();
  for (const option of options) {
    const key = normalize(option);
    if (seen.has(key)) return { options, error: `La opción «${option}» está repetida.` };
    seen.add(key);
  }

  return { options, error: null };
}

export interface VerticalPayload {
  name: string;
  slug?: string;
}

export function VerticalForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (payload: VerticalPayload) => Promise<string | null>;
}): ReactElement {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();

    if (trimmedName.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    if (trimmedSlug && !SLUG_PATTERN.test(trimmedSlug)) {
      setError('El slug solo admite minúsculas, números y guiones (sin guion inicial ni final).');
      return;
    }

    setBusy(true);
    setError(null);
    const failure = await onCreate({
      name: trimmedName,
      ...(trimmedSlug ? { slug: trimmedSlug } : {}),
    });
    setBusy(false);
    if (failure) setError(failure);
  }

  return (
    <Modal
      open
      title="Nueva vertical"
      description="Una vertical agrupa las categorías de un sector comercial."
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={buttonStyles('secondary')} onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="submit"
            form="form-vertical"
            className={buttonStyles('primary')}
            disabled={busy}
          >
            {busy ? 'Creando…' : 'Crear vertical'}
          </button>
        </>
      }
    >
      <form id="form-vertical" className="space-y-4" onSubmit={submit} noValidate>
        {error ? <Banner tone="error" message={error} /> : null}
        <Field
          id="vertical-name"
          label="Nombre"
          hint="Visible para compradores, por ejemplo «Prenderías»."
        >
          <input
            id="vertical-name"
            className={inputStyles}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={60}
            autoComplete="off"
            autoFocus
          />
        </Field>
        <Field
          id="vertical-slug"
          label="Slug (opcional)"
          hint="Se genera desde el nombre si lo dejas vacío."
        >
          <input
            id="vertical-slug"
            className={inputStyles}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="prenderias"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            autoComplete="off"
          />
        </Field>
      </form>
    </Modal>
  );
}

export interface CategoryPayload {
  name: string;
  slug?: string;
  parentId?: string;
}

export function CategoryForm({
  verticalName,
  categories,
  onCancel,
  onCreate,
}: {
  verticalName: string | null;
  categories: Category[];
  onCancel: () => void;
  onCreate: (payload: CategoryPayload) => Promise<string | null>;
}): ReactElement {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();

    if (trimmedName.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    if (trimmedSlug && !SLUG_PATTERN.test(trimmedSlug)) {
      setError('El slug solo admite minúsculas, números y guiones (sin guion inicial ni final).');
      return;
    }

    setBusy(true);
    setError(null);
    const failure = await onCreate({
      name: trimmedName,
      ...(trimmedSlug ? { slug: trimmedSlug } : {}),
      ...(parentId ? { parentId } : {}),
    });
    setBusy(false);
    if (failure) setError(failure);
  }

  return (
    <Modal
      open
      title="Nueva categoría"
      description={
        verticalName ? `Se creará dentro de ${verticalName}.` : 'Selecciona una vertical primero.'
      }
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={buttonStyles('secondary')} onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="submit"
            form="form-category"
            className={buttonStyles('primary')}
            disabled={busy}
          >
            {busy ? 'Creando…' : 'Crear categoría'}
          </button>
        </>
      }
    >
      <form id="form-category" className="space-y-4" onSubmit={submit} noValidate>
        {error ? <Banner tone="error" message={error} /> : null}
        <Field id="category-name" label="Nombre" hint="Por ejemplo «Celulares» o «Tablets».">
          <input
            id="category-name"
            className={inputStyles}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={60}
            autoComplete="off"
            autoFocus
          />
        </Field>
        <Field id="category-slug" label="Slug (opcional)" hint="Único dentro de la vertical.">
          <input
            id="category-slug"
            className={inputStyles}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="celulares"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            autoComplete="off"
          />
        </Field>
        <Field
          id="category-parent"
          label="Categoría padre (opcional)"
          hint="Crea jerarquía, por ejemplo «Celulares › Android»."
        >
          <select
            id="category-parent"
            className={inputStyles}
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
          >
            <option value="">Sin categoría padre</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
      </form>
    </Modal>
  );
}

export interface AttributePayload {
  name: string;
  code: string;
  type: AttributeType;
  isRequired: boolean;
  isFilterable: boolean;
  options: string[];
}

export function AttributeForm({
  categoryName,
  onCancel,
  onCreate,
}: {
  categoryName: string | null;
  onCancel: () => void;
  onCreate: (payload: AttributePayload) => Promise<string | null>;
}): ReactElement {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<AttributeType>('TEXT');
  const [required, setRequired] = useState(false);
  const [filterable, setFilterable] = useState(true);
  const [options, setOptions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedCode = code.trim();

    if (trimmedName.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    if (!CODE_PATTERN.test(trimmedCode)) {
      setError('El code solo admite minúsculas, números y guiones (por ejemplo «tipo-material»).');
      return;
    }

    const parsed = parseOptions(options);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    if (type === 'ENUM' && parsed.options.length === 0) {
      setError('Un atributo de lista de opciones necesita al menos una opción.');
      return;
    }

    setBusy(true);
    setError(null);
    const failure = await onCreate({
      name: trimmedName,
      code: trimmedCode,
      type,
      isRequired: required,
      isFilterable: filterable,
      options: parsed.options,
    });
    setBusy(false);
    if (failure) setError(failure);
  }

  return (
    <Modal
      open
      title="Nuevo atributo"
      description={
        categoryName ? `Se creará en ${categoryName}.` : 'Selecciona una categoría primero.'
      }
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={buttonStyles('secondary')} onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="submit"
            form="form-attribute"
            className={buttonStyles('primary')}
            disabled={busy}
          >
            {busy ? 'Creando…' : 'Crear atributo'}
          </button>
        </>
      }
    >
      <form id="form-attribute" className="space-y-4" onSubmit={submit} noValidate>
        {error ? <Banner tone="error" message={error} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="attribute-name" label="Nombre" hint="Visible en el formulario de publicación.">
            <input
              id="attribute-name"
              className={inputStyles}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
              maxLength={60}
              autoComplete="off"
              autoFocus
            />
          </Field>
          <Field
            id="attribute-code"
            label="Code"
            hint="Identificador interno estable, por ejemplo «marca»."
          >
            <input
              id="attribute-code"
              className={inputStyles}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="marca"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              autoComplete="off"
            />
          </Field>
        </div>

        <Field
          id="attribute-type"
          label="Tipo"
          hint="Un atributo de lista permite filtrar por opciones cerradas."
        >
          <select
            id="attribute-type"
            className={inputStyles}
            value={type}
            onChange={(event) => setType(event.target.value as AttributeType)}
          >
            {ATTRIBUTE_TYPES.map((option) => (
              <option key={option} value={option}>
                {ATTRIBUTE_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </Field>

        {type === 'ENUM' ? (
          <Field
            id="attribute-options"
            label="Opciones"
            hint="Una por línea (o separadas por comas). Se eliminan duplicados."
          >
            <textarea
              id="attribute-options"
              className={cx(inputStyles, 'min-h-24 resize-y')}
              value={options}
              onChange={(event) => setOptions(event.target.value)}
              placeholder={'64GB\n128GB\n256GB'}
            />
          </Field>
        ) : null}

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-stone-700">Comportamiento</legend>
          <label className="flex items-start gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-700 focus:ring-brand-700/30"
              checked={required}
              onChange={(event) => setRequired(event.target.checked)}
            />
            <span>
              <span className="font-medium text-stone-800">Obligatorio</span>
              <span className="block text-xs text-stone-500">
                La publicación no se puede guardar sin este dato.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-700 focus:ring-brand-700/30"
              checked={filterable}
              onChange={(event) => setFilterable(event.target.checked)}
            />
            <span>
              <span className="font-medium text-stone-800">Filtrable</span>
              <span className="block text-xs text-stone-500">
                Se podrá usar como filtro en el catálogo público.
              </span>
            </span>
          </label>
        </fieldset>
      </form>
    </Modal>
  );
}
