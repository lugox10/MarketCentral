import { ApiError, getJson, patchJson, postJson } from './api';

export interface BusinessCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface BusinessCategoryList {
  items: BusinessCategory[];
  used: number;
  limit: number;
  remaining: number;
  canCreate: boolean;
  planCode: string;
  upgradeHint: string;
}

const BASE = '/businesses/me/categories';

export function fetchBusinessCategories(): Promise<BusinessCategoryList> {
  return getJson<BusinessCategoryList>(BASE);
}

export function createBusinessCategory(input: {
  name: string;
  parentId?: string | null;
}): Promise<BusinessCategoryList> {
  return postJson<BusinessCategoryList>(BASE, {
    name: input.name,
    ...(input.parentId ? { parentId: input.parentId } : {}),
  });
}

export function updateBusinessCategory(
  categoryId: string,
  input: { name?: string; isActive?: boolean },
): Promise<BusinessCategoryList> {
  return patchJson<BusinessCategoryList>(`${BASE}/${categoryId}`, input);
}

/** Mensaje legible para los códigos de error de categorías del backend. */
export function categoryErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'No pudimos conectar con el servidor.';
  switch (error.code) {
    case 'CATEGORY_LIMIT_REACHED':
      return 'No te quedan categorías disponibles en tu plan. Desactiva una o mejora el plan.';
    case 'DUPLICATE_CATEGORY':
      return 'Ya existe una categoría con ese nombre en tu negocio.';
    case 'INVALID_CATEGORY_PARENT':
      return 'La categoría padre debe ser de tu vertical y estar activa.';
    case 'CATEGORY_NOT_OWNED':
      return 'Esa categoría pertenece a otro negocio.';
    case 'CATEGORY_HAS_LISTINGS':
      return 'La categoría tiene publicaciones activas; muévelas antes de desactivarla.';
    case 'CATEGORY_NOT_FOUND':
      return 'No encontramos la categoría.';
    case 'INVALID_CATEGORY_NAME':
      return 'El nombre debe tener entre 2 y 60 caracteres.';
    default:
      return error.message;
  }
}
