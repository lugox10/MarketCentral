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
  createdAt: Date;
  updatedAt: Date;
}

export interface AttributeOptionRecord {
  id: string;
  value: string;
}

export interface AttributeRecord {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  type: AttributeType;
  isRequired: boolean;
  isFilterable: boolean;
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

export interface TaxonomyRepository {
  listActiveVerticals(): Promise<VerticalRecord[]>;
  listCategoriesByVertical(verticalId: string): Promise<CategoryRecord[]>;
  listAttributesByCategory(categoryId: string): Promise<AttributeRecord[]>;

  findVerticalById(id: string): Promise<VerticalRecord | null>;
  findCategoryById(id: string): Promise<CategoryRecord | null>;
  /** Devuelve el padre y sus ancestros (para detectar ciclos). */
  listAncestors(categoryId: string): Promise<ParentLink[]>;

  existsVerticalSlug(slug: string): Promise<boolean>;
  existsVerticalName(name: string): Promise<boolean>;
  existsCategorySlug(verticalId: string, slug: string): Promise<boolean>;
  existsAttributeCode(categoryId: string, code: string): Promise<boolean>;

  createVertical(input: CreateVerticalInput): Promise<VerticalRecord>;
  createCategory(input: CreateCategoryInput): Promise<CategoryRecord>;
  createAttribute(input: CreateAttributeInput): Promise<AttributeRecord>;
}
