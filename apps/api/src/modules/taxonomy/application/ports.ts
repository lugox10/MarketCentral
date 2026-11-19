import type { AttributeType } from '../domain/taxonomy.js';

/** Registros tal como los devuelve la persistencia (fechas en ISO). */
export interface VerticalRecord {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryRecord {
  id: string;
  verticalId: string;
  name: string;
  slug: string;
  parentId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttributeOptionRecord {
  id: string;
  value: string;
  isActive: boolean;
}

export interface AttributeRecord {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  type: AttributeType;
  isRequired: boolean;
  isFilterable: boolean;
  isActive: boolean;
  options: AttributeOptionRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVerticalInput {
  name: string;
  slug: string;
}

export interface CreateCategoryInput {
  verticalId: string;
  name: string;
  slug: string;
  parentId: string | null;
}

export interface CreateAttributeInput {
  categoryId: string;
  name: string;
  code: string;
  type: AttributeType;
  isRequired: boolean;
  isFilterable: boolean;
  options: string[];
}

export interface ParentLink {
  id: string;
  parentId: string | null;
}

/**
 * Cambios permitidos sobre un elemento de taxonomía.
 *
 * No se permite cambiar el `slug` de una vertical o categoría, ni el `code` de
 * un atributo: son identificadores que ya viajan en URLs y en `listing.attributes`.
 */
export interface VerticalPatch {
  name?: string;
  isActive?: boolean;
}

export interface CategoryPatch {
  name?: string;
  isActive?: boolean;
}

export interface AttributePatch {
  name?: string;
  isRequired?: boolean;
  isFilterable?: boolean;
  isActive?: boolean;
}

export interface OptionPatch {
  value?: string;
  isActive?: boolean;
}

export interface TaxonomyRepository {
  /** `includeInactive` solo lo usan las vistas de administración. */
  listVerticals(includeInactive: boolean): Promise<VerticalRecord[]>;
  listCategoriesByVertical(verticalId: string, includeInactive: boolean): Promise<CategoryRecord[]>;
  listAttributesByCategory(
    categoryId: string,
    includeInactive: boolean,
  ): Promise<AttributeRecord[]>;

  findVerticalById(id: string): Promise<VerticalRecord | null>;
  findCategoryById(id: string): Promise<CategoryRecord | null>;
  findAttributeById(id: string): Promise<AttributeRecord | null>;
  findOptionById(id: string): Promise<AttributeOptionRecord | null>;
  /** Devuelve el padre y sus ancestros (para detectar ciclos). */
  listAncestors(categoryId: string): Promise<ParentLink[]>;

  existsVerticalSlug(slug: string): Promise<boolean>;
  existsVerticalName(name: string): Promise<boolean>;
  existsCategorySlug(verticalId: string, slug: string): Promise<boolean>;
  existsAttributeCode(categoryId: string, code: string): Promise<boolean>;

  createVertical(input: CreateVerticalInput): Promise<VerticalRecord>;
  createCategory(input: CreateCategoryInput): Promise<CategoryRecord>;
  createAttribute(input: CreateAttributeInput): Promise<AttributeRecord>;

  updateVertical(id: string, patch: VerticalPatch): Promise<VerticalRecord>;
  updateCategory(id: string, patch: CategoryPatch): Promise<CategoryRecord>;
  updateAttribute(id: string, patch: AttributePatch): Promise<AttributeRecord>;
  updateOption(id: string, patch: OptionPatch): Promise<AttributeOptionRecord>;
}
