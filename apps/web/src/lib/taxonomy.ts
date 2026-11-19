import { getJson, patchJson, postJson } from './api';

export type AttributeType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'ENUM';

export const ATTRIBUTE_TYPES: AttributeType[] = ['TEXT', 'NUMBER', 'BOOLEAN', 'ENUM'];

export const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, string> = {
  TEXT: 'Texto',
  NUMBER: 'Número',
  BOOLEAN: 'Sí / No',
  ENUM: 'Lista de opciones',
};

export interface Vertical {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  verticalId: string;
  name: string;
  slug: string;
  parentId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttributeOption {
  id: string;
  value: string;
  isActive: boolean;
}

export interface AttributeDefinition {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  type: AttributeType;
  isRequired: boolean;
  isFilterable: boolean;
  isActive: boolean;
  options: AttributeOption[];
  createdAt: string;
  updatedAt: string;
}

interface VerticalList {
  items: Vertical[];
}

interface CategoryList {
  verticalId: string;
  items: Category[];
}

interface AttributeList {
  categoryId: string;
  items: AttributeDefinition[];
}

export async function fetchVerticals(): Promise<Vertical[]> {
  const payload = await getJson<VerticalList>('/taxonomy/verticals');
  return payload.items;
}

export async function fetchCategories(verticalId: string): Promise<Category[]> {
  const payload = await getJson<CategoryList>(`/taxonomy/verticals/${verticalId}/categories`);
  return payload.items;
}

export async function fetchAttributes(categoryId: string): Promise<AttributeDefinition[]> {
  const payload = await getJson<AttributeList>(`/taxonomy/categories/${categoryId}/attributes`);
  return payload.items;
}

/**
 * Listados del panel: incluyen los elementos desactivados, que el catálogo
 * público ya no muestra pero el administrador debe poder reactivar.
 */
export async function fetchAdminVerticals(): Promise<Vertical[]> {
  const payload = await getJson<VerticalList>('/admin/taxonomy/verticals');
  return payload.items;
}

export async function fetchAdminCategories(verticalId: string): Promise<Category[]> {
  const payload = await getJson<CategoryList>(`/admin/taxonomy/verticals/${verticalId}/categories`);
  return payload.items;
}

export async function fetchAdminAttributes(categoryId: string): Promise<AttributeDefinition[]> {
  const payload = await getJson<AttributeList>(
    `/admin/taxonomy/categories/${categoryId}/attributes`,
  );
  return payload.items;
}

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

export function updateVertical(id: string, patch: VerticalPatch): Promise<Vertical> {
  return patchJson<Vertical>(`/admin/taxonomy/verticals/${id}`, patch);
}

export function updateCategory(id: string, patch: CategoryPatch): Promise<Category> {
  return patchJson<Category>(`/admin/taxonomy/categories/${id}`, patch);
}

export function updateAttribute(id: string, patch: AttributePatch): Promise<AttributeDefinition> {
  return patchJson<AttributeDefinition>(`/admin/taxonomy/attributes/${id}`, patch);
}

export function updateOption(
  attributeId: string,
  optionId: string,
  patch: OptionPatch,
): Promise<AttributeOption> {
  return patchJson<AttributeOption>(
    `/admin/taxonomy/attributes/${attributeId}/options/${optionId}`,
    patch,
  );
}

export interface CreateVerticalInput {
  name: string;
  slug?: string;
}

export function createVertical(input: CreateVerticalInput): Promise<Vertical> {
  return postJson<Vertical>('/admin/taxonomy/verticals', input);
}

export interface CreateCategoryInput {
  verticalId: string;
  name: string;
  slug?: string;
  parentId?: string | null;
}

export function createCategory(input: CreateCategoryInput): Promise<Category> {
  const body = {
    verticalId: input.verticalId,
    name: input.name,
    ...(input.slug ? { slug: input.slug } : {}),
    ...(input.parentId ? { parentId: input.parentId } : {}),
  };
  return postJson<Category>('/admin/taxonomy/categories', body);
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

export function createAttribute(input: CreateAttributeInput): Promise<AttributeDefinition> {
  const body = {
    categoryId: input.categoryId,
    name: input.name,
    code: input.code,
    type: input.type,
    isRequired: input.isRequired,
    isFilterable: input.isFilterable,
    ...(input.type === 'ENUM' ? { options: input.options } : {}),
  };
  return postJson<AttributeDefinition>('/admin/taxonomy/attributes', body);
}
