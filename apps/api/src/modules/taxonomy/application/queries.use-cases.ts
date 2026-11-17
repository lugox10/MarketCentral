import { Inject, Injectable } from '@nestjs/common';

import { TaxonomyError } from '../domain/taxonomy-error.js';
import type { AttributeRecord, CategoryRecord, VerticalRecord } from './ports.js';
import { TAXONOMY_REPOSITORY } from './tokens.js';
import type { TaxonomyRepository } from './ports.js';

/**
 * Consultas públicas del catálogo de taxonomía. No requieren sesión: son las
 * mismas verticales, categorías y atributos que verá el marketplace.
 */
@Injectable()
export class ListActiveVerticalsUseCase {
  constructor(@Inject(TAXONOMY_REPOSITORY) private readonly repository: TaxonomyRepository) {}

  async execute(): Promise<VerticalRecord[]> {
    return this.repository.listActiveVerticals();
  }
}

@Injectable()
export class ListCategoriesUseCase {
  constructor(@Inject(TAXONOMY_REPOSITORY) private readonly repository: TaxonomyRepository) {}

  async execute(verticalId: string): Promise<CategoryRecord[]> {
    const vertical = await this.repository.findVerticalById(verticalId);
    if (!vertical) {
      throw new TaxonomyError('VERTICAL_NOT_FOUND', 'La vertical no existe');
    }

    return this.repository.listCategoriesByVertical(verticalId);
  }
}

@Injectable()
export class ListAttributesUseCase {
  constructor(@Inject(TAXONOMY_REPOSITORY) private readonly repository: TaxonomyRepository) {}

  async execute(categoryId: string): Promise<AttributeRecord[]> {
    const category = await this.repository.findCategoryById(categoryId);
    if (!category) {
      throw new TaxonomyError('CATEGORY_NOT_FOUND', 'La categoría no existe');
    }

    return this.repository.listAttributesByCategory(categoryId);
  }
}
