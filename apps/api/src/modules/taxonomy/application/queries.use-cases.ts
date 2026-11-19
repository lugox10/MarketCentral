import { Inject, Injectable } from '@nestjs/common';

import { TaxonomyError } from '../domain/taxonomy-error.js';
import type { AttributeRecord, CategoryRecord, VerticalRecord } from './ports.js';
import { TAXONOMY_REPOSITORY } from './tokens.js';
import type { TaxonomyRepository } from './ports.js';

/**
 * Consultas del catálogo de taxonomía.
 *
 * Las rutas públicas de `/taxonomy` solo devuelven elementos activos: así el
 * formulario de una publicación nueva nunca ofrece una categoría, atributo u
 * opción retirados. Las rutas de `/admin/taxonomy` piden `includeInactive` para
 * poder reactivarlos desde el panel.
 */
@Injectable()
export class ListActiveVerticalsUseCase {
  constructor(@Inject(TAXONOMY_REPOSITORY) private readonly repository: TaxonomyRepository) {}

  async execute(includeInactive = false): Promise<VerticalRecord[]> {
    return this.repository.listVerticals(includeInactive);
  }
}

@Injectable()
export class ListCategoriesUseCase {
  constructor(@Inject(TAXONOMY_REPOSITORY) private readonly repository: TaxonomyRepository) {}

  async execute(verticalId: string, includeInactive = false): Promise<CategoryRecord[]> {
    const vertical = await this.repository.findVerticalById(verticalId);
    if (!vertical) {
      throw new TaxonomyError('VERTICAL_NOT_FOUND', 'La vertical no existe');
    }

    return this.repository.listCategoriesByVertical(verticalId, includeInactive);
  }
}

@Injectable()
export class ListAttributesUseCase {
  constructor(@Inject(TAXONOMY_REPOSITORY) private readonly repository: TaxonomyRepository) {}

  async execute(categoryId: string, includeInactive = false): Promise<AttributeRecord[]> {
    const category = await this.repository.findCategoryById(categoryId);
    if (!category) {
      throw new TaxonomyError('CATEGORY_NOT_FOUND', 'La categoría no existe');
    }

    return this.repository.listAttributesByCategory(categoryId, includeInactive);
  }
}
