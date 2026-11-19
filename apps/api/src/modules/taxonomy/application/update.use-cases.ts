import { Inject, Injectable } from '@nestjs/common';

import { TaxonomyError } from '../domain/taxonomy-error.js';
import { isValidName, normalizeName } from '../domain/taxonomy.js';
import type {
  AttributeOptionRecord,
  AttributeRecord,
  CategoryRecord,
  VerticalRecord,
} from './ports.js';
import { TAXONOMY_REPOSITORY } from './tokens.js';
import type {
  AttributePatch,
  CategoryPatch,
  OptionPatch,
  TaxonomyRepository,
  VerticalPatch,
} from './ports.js';

/**
 * Edición y borrado lógico de la taxonomía desde el panel de administración.
 *
 * Regla de negocio: nada se borra de verdad. Desactivar una vertical, categoría,
 * atributo u opción solo lo retira de los formularios y listados públicos; las
 * publicaciones antiguas conservan sus valores en `listing.attributes`.
 *
 * No se permite renombrar el `slug` de vertical/categoría ni el `code` de un
 * atributo: ya viajan en URLs y en los atributos guardados de cada publicación.
 */
@Injectable()
export class UpdateVerticalUseCase {
  constructor(@Inject(TAXONOMY_REPOSITORY) private readonly repository: TaxonomyRepository) {}

  async execute(id: string, patch: VerticalPatch): Promise<VerticalRecord> {
    await this.requireVertical(id);
    const next: VerticalPatch = { isActive: patch.isActive };

    if (patch.name !== undefined) {
      const name = normalizeName(patch.name);
      if (!isValidName(name)) {
        throw new TaxonomyError('INVALID_NAME', 'El nombre debe tener entre 2 y 60 caracteres');
      }
      next.name = name;
    }

    assertHasChanges(next);
    return this.repository.updateVertical(id, next);
  }

  private async requireVertical(id: string): Promise<VerticalRecord> {
    const vertical = await this.repository.findVerticalById(id);
    if (!vertical) throw new TaxonomyError('VERTICAL_NOT_FOUND', 'La vertical no existe');
    return vertical;
  }
}

@Injectable()
export class UpdateCategoryUseCase {
  constructor(@Inject(TAXONOMY_REPOSITORY) private readonly repository: TaxonomyRepository) {}

  async execute(id: string, patch: CategoryPatch): Promise<CategoryRecord> {
    const category = await this.repository.findCategoryById(id);
    if (!category) throw new TaxonomyError('CATEGORY_NOT_FOUND', 'La categoría no existe');

    const next: CategoryPatch = { isActive: patch.isActive };

    if (patch.name !== undefined) {
      const name = normalizeName(patch.name);
      if (!isValidName(name)) {
        throw new TaxonomyError('INVALID_NAME', 'El nombre debe tener entre 2 y 60 caracteres');
      }
      next.name = name;
    }

    assertHasChanges(next);
    return this.repository.updateCategory(id, next);
  }
}

@Injectable()
export class UpdateAttributeUseCase {
  constructor(@Inject(TAXONOMY_REPOSITORY) private readonly repository: TaxonomyRepository) {}

  async execute(id: string, patch: AttributePatch): Promise<AttributeRecord> {
    const attribute = await this.repository.findAttributeById(id);
    if (!attribute) throw new TaxonomyError('ATTRIBUTE_NOT_FOUND', 'El atributo no existe');

    const next: AttributePatch = {
      isActive: patch.isActive,
      isRequired: patch.isRequired,
      isFilterable: patch.isFilterable,
    };

    if (patch.name !== undefined) {
      const name = normalizeName(patch.name);
      if (!isValidName(name)) {
        throw new TaxonomyError('INVALID_NAME', 'El nombre debe tener entre 2 y 60 caracteres');
      }
      next.name = name;
    }

    assertHasChanges(next);
    return this.repository.updateAttribute(id, next);
  }
}

@Injectable()
export class UpdateOptionUseCase {
  constructor(@Inject(TAXONOMY_REPOSITORY) private readonly repository: TaxonomyRepository) {}

  async execute(id: string, patch: OptionPatch): Promise<AttributeOptionRecord> {
    const option = await this.repository.findOptionById(id);
    if (!option) throw new TaxonomyError('OPTION_NOT_FOUND', 'La opción no existe');

    const next: OptionPatch = { isActive: patch.isActive };

    if (patch.value !== undefined) {
      const value = patch.value.trim();
      if (value.length < 1 || value.length > 60) {
        throw new TaxonomyError('INVALID_OPTIONS', 'La opción debe tener entre 1 y 60 caracteres');
      }
      next.value = value;
    }

    assertHasChanges(next);
    return this.repository.updateOption(id, next);
  }
}

/** Un PATCH sin ningún campo real es un error de entrada, no un no-op silencioso. */
function assertHasChanges(patch: object): void {
  const meaningful = Object.values(patch).filter((value) => value !== undefined);
  if (meaningful.length === 0) {
    throw new TaxonomyError('INVALID_INPUT', 'Envía al menos un campo para actualizar');
  }
}
