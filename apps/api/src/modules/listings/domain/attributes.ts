import { ListingError } from './listing-error.js';

export type AttributeTypeName = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'ENUM';

export interface AttributeDefinitionView {
  code: string;
  name: string;
  type: AttributeTypeName;
  isRequired: boolean;
  options: string[];
}

export type AttributeValue = string | number | boolean;

const TEXT_MAX = 200;

/**
 * Valida y normaliza los atributos variables de una publicación contra las
 * definiciones de su categoría (ADR-009). El resultado se guarda tal cual en
 * `listing.attributes` junto con `attributesSchemaVersion`.
 *
 * Rechaza códigos desconocidos a propósito: un cliente no puede inventar
 * atributos que luego el catálogo no sabría filtrar.
 */
export function validateAttributes(
  definitions: AttributeDefinitionView[],
  input: Record<string, unknown> | null | undefined,
): Record<string, AttributeValue> {
  const values = input ?? {};
  const known = new Map(definitions.map((definition) => [definition.code, definition]));

  for (const code of Object.keys(values)) {
    if (!known.has(code)) {
      throw new ListingError(
        'INVALID_ATTRIBUTES',
        `El atributo «${code}» no existe en la categoría`,
      );
    }
  }

  const result: Record<string, AttributeValue> = {};

  for (const definition of definitions) {
    const raw = values[definition.code];
    const empty =
      raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');

    if (empty) {
      if (definition.isRequired) {
        throw new ListingError(
          'INVALID_ATTRIBUTES',
          `El atributo «${definition.name}» es obligatorio`,
        );
      }
      continue;
    }

    result[definition.code] = coerce(definition, raw);
  }

  return result;
}

function coerce(definition: AttributeDefinitionView, raw: unknown): AttributeValue {
  switch (definition.type) {
    case 'TEXT': {
      if (typeof raw !== 'string') {
        throw new ListingError('INVALID_ATTRIBUTES', `«${definition.name}» debe ser texto`);
      }
      const value = raw.trim();
      if (value.length === 0 || value.length > TEXT_MAX) {
        throw new ListingError(
          'INVALID_ATTRIBUTES',
          `«${definition.name}» debe tener entre 1 y ${TEXT_MAX} caracteres`,
        );
      }
      return value;
    }
    case 'NUMBER': {
      const value = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        throw new ListingError(
          'INVALID_ATTRIBUTES',
          `«${definition.name}» debe ser un número entero`,
        );
      }
      return value;
    }
    case 'BOOLEAN': {
      if (typeof raw !== 'boolean') {
        throw new ListingError('INVALID_ATTRIBUTES', `«${definition.name}» debe ser sí o no`);
      }
      return raw;
    }
    case 'ENUM': {
      const value = typeof raw === 'string' ? raw.trim() : String(raw);
      if (!definition.options.includes(value)) {
        throw new ListingError(
          'INVALID_ATTRIBUTES',
          `«${definition.name}» debe ser una de: ${definition.options.join(', ')}`,
        );
      }
      return value;
    }
    default:
      throw new ListingError('INVALID_ATTRIBUTES', 'Tipo de atributo no soportado');
  }
}
