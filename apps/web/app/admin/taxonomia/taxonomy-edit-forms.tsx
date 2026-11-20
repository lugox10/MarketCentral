'use client';

import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import { Modal } from '../../../src/components/modal';
import { Banner, Field, buttonStyles, inputStyles } from '../../../src/components/taxonomy-ui';
import {
  ATTRIBUTE_TYPE_LABELS,
  type AttributeDefinition,
  type AttributeOption,
  type Category,
  type Vertical,
} from '../../../src/lib/taxonomy';

/**
 * Formularios de edición de taxonomía.
 *
 * El `slug` de la vertical/categoría y el `code` del atributo son de solo
 * lectura: ya viajan en URLs públicas y en los valores guardados de cada
 * publicación, así que renombrarlos rompería datos existentes.
 */
const READONLY_HINT = 'El identificador interno no se puede modificar por integridad de datos.';

function ReadOnlyField({
  id,
  label,
  value,
}: {
  id: string;
  label: string;
  value: string;
}): ReactElement {
  return (
    <Field id={id} label={label} hint={READONLY_HINT}>
      <input
        id={id}
        className={`${inputStyles} cursor-not-allowed bg-stone-100 text-stone-500`}
        value={value}
        readOnly
        disabled
        aria-describedby={`${id}-hint`}
      />
    </Field>
  );
}

export function VerticalEditForm({
  vertical,
  onCancel,
  onSave,
}: {
  vertical: Vertical;
  onCancel: () => void;
  onSave: (name: string) => Promise<string | null>;
}): ReactElement {
  const [name, setName] = useState(vertical.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    if (trimmed === vertical.name) {
      onCancel();
      return;
    }

    setBusy(true);
    setError(null);
    const failure = await onSave(trimmed);
    setBusy(false);
    if (failure) setError(failure);
    else onCancel();
  }

  return (
    <Modal
      open
      title="Editar vertical"
      description="Cambia el nombre visible. El slug queda fijo."
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={buttonStyles('secondary')} onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="submit"
            form="form-edit-vertical"
            className={buttonStyles('primary')}
            disabled={busy}
          >
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      <form id="form-edit-vertical" className="space-y-4" onSubmit={submit} noValidate>
        {error ? <Banner tone="error" message={error} /> : null}
        <Field id="edit-vertical-name" label="Nombre" hint="Visible para compradores.">
          <input
            id="edit-vertical-name"
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
        <ReadOnlyField id="edit-vertical-slug" label="Slug" value={`/${vertical.slug}`} />
      </form>
    </Modal>
  );
}

export function CategoryEditForm({
  category,
  onCancel,
  onSave,
}: {
  category: Category;
  onCancel: () => void;
  onSave: (name: string) => Promise<string | null>;
}): ReactElement {
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    if (trimmed === category.name) {
      onCancel();
      return;
    }

    setBusy(true);
    setError(null);
    const failure = await onSave(trimmed);
    setBusy(false);
    if (failure) setError(failure);
    else onCancel();
  }

  return (
    <Modal
      open
      title="Editar categoría"
      description="Cambia el nombre visible. El slug queda fijo."
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={buttonStyles('secondary')} onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="submit"
            form="form-edit-category"
            className={buttonStyles('primary')}
            disabled={busy}
          >
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      <form id="form-edit-category" className="space-y-4" onSubmit={submit} noValidate>
        {error ? <Banner tone="error" message={error} /> : null}
        <Field
          id="edit-category-name"
          label="Nombre"
          hint="Visible en el catálogo y en los filtros."
        >
          <input
            id="edit-category-name"
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
        <ReadOnlyField id="edit-category-slug" label="Slug" value={`/${category.slug}`} />
      </form>
    </Modal>
  );
}

export interface AttributeEditPayload {
  name: string;
  isRequired: boolean;
  isFilterable: boolean;
}

export function AttributeEditForm({
  attribute,
  onCancel,
  onSave,
  onToggleOption,
  onAddOption,
}: {
  attribute: AttributeDefinition;
  onCancel: () => void;
  onSave: (payload: AttributeEditPayload) => Promise<string | null>;
  onToggleOption: (optionId: string, isActive: boolean) => Promise<string | null>;
  onAddOption: (value: string) => Promise<string | null>;
}): ReactElement {
  const [name, setName] = useState(attribute.name);
  const [required, setRequired] = useState(attribute.isRequired);
  const [filterable, setFilterable] = useState(attribute.isFilterable);
  const [options, setOptions] = useState<AttributeOption[]>(attribute.options);
  const [newOption, setNewOption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [optionBusy, setOptionBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }

    setBusy(true);
    setError(null);
    const failure = await onSave({
      name: trimmed,
      isRequired: required,
      isFilterable: filterable,
    });
    setBusy(false);
    if (failure) setError(failure);
    else onCancel();
  }

  async function addOption(): Promise<void> {
    const value = newOption.trim();
    if (!value) return;
    setOptionBusy(true);
    setError(null);
    const failure = await onAddOption(value);
    setOptionBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    setOptions((current) => [...current, { id: `pending-${value}`, value, isActive: true }]);
    setNewOption('');
  }

  async function toggleOption(option: AttributeOption): Promise<void> {
    setOptionBusy(true);
    setError(null);
    const next = !option.isActive;
    const failure = await onToggleOption(option.id, next);
    setOptionBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    setOptions((current) =>
      current.map((item) => (item.id === option.id ? { ...item, isActive: next } : item)),
    );
  }

  return (
    <Modal
      open
      title="Editar atributo"
      description="Ajusta el nombre, la obligatoriedad, los filtros y las opciones."
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={buttonStyles('secondary')} onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="submit"
            form="form-edit-attribute"
            className={buttonStyles('primary')}
            disabled={busy}
          >
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      <form id="form-edit-attribute" className="space-y-4" onSubmit={submit} noValidate>
        {error ? <Banner tone="error" message={error} /> : null}

        <Field
          id="edit-attribute-name"
          label="Nombre"
          hint="Es la etiqueta del campo en el formulario."
        >
          <input
            id="edit-attribute-name"
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

        <ReadOnlyField id="edit-attribute-code" label="Code" value={attribute.code} />

        <div>
          <p className="text-sm font-medium text-stone-700">Tipo</p>
          <p className="mt-1 inline-flex rounded-md bg-stone-100 px-2 py-1 font-mono text-xs text-stone-600">
            {ATTRIBUTE_TYPE_LABELS[attribute.type]}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            El tipo tampoco cambia: los valores ya guardados dependen de él.
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-stone-300"
            checked={required}
            onChange={(event) => setRequired(event.target.checked)}
          />
          <span>
            Obligatorio
            <span className="block text-xs text-stone-500">
              Los compradores deberán completarlo al publicar.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-stone-300"
            checked={filterable}
            onChange={(event) => setFilterable(event.target.checked)}
          />
          <span>
            Filtrable
            <span className="block text-xs text-stone-500">
              Aparece en los filtros del catálogo público.
            </span>
          </span>
        </label>

        {attribute.type === 'ENUM' ? (
          <div className="rounded-lg border border-stone-200 p-3">
            <p className="text-sm font-medium text-stone-700">Opciones</p>
            <p className="mt-1 text-xs text-stone-500">
              Quitar una opción la desactiva: no se borra y las publicaciones antiguas la conservan.
            </p>

            <ul className="mt-3 space-y-1.5">
              {options.map((option) => (
                <li
                  key={option.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-stone-50 px-2 py-1.5"
                >
                  <span
                    className={
                      option.isActive
                        ? 'truncate text-sm text-stone-800'
                        : 'truncate text-sm text-stone-400 line-through'
                    }
                  >
                    {option.value}
                  </span>
                  <button
                    type="button"
                    className={buttonStyles('ghost', 'sm')}
                    disabled={optionBusy}
                    onClick={() => void toggleOption(option)}
                  >
                    {option.isActive ? 'Quitar' : 'Restaurar'}
                  </button>
                </li>
              ))}
              {options.length === 0 ? (
                <li className="text-xs text-stone-500">Este atributo aún no tiene opciones.</li>
              ) : null}
            </ul>

            <div className="mt-3 flex gap-2">
              <input
                className={inputStyles}
                value={newOption}
                onChange={(event) => setNewOption(event.target.value)}
                placeholder="Nueva opción, por ejemplo 256GB"
                maxLength={60}
                aria-label="Nueva opción"
              />
              <button
                type="button"
                className={buttonStyles('secondary', 'sm')}
                disabled={optionBusy || newOption.trim().length === 0}
                onClick={() => void addOption()}
              >
                Añadir
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
