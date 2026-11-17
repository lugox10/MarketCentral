import { getJson, postJson } from './api';

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
  createdAt: string;
  updatedAt: string;
}

export interface AttributeOption {
  id: string;
  value: string;
}

export interface AttributeDefinition {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  type: AttributeType;
  isRequired: boolean;
  isFilterable: boolean;
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
