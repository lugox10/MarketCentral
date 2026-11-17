import { Inject, Injectable } from '@nestjs/common';

import {
  isAttributeType,
  isValidName,
  normalizeCode,
  normalizeName,
  normalizeOptions,
  resolveSlug,
  validateOptionsForType,
} from '../domain/taxonomy.js';
import { TaxonomyError } from '../domain/taxonomy-error.js';
import type { AttributeRecord, CategoryRecord, VerticalRecord } from './ports.js';
import { TAXONOMY_REPOSITORY } from './tokens.js';
import type { TaxonomyRepository } from './ports.js';

const MAX_HIERARCHY_DEPTH = 100;

@Injectable()
export class CreateVerticalUseCase {
  constructor(@Inject(TAXONOMY_REPOSITORY) private readonly repository: TaxonomyRepository) {}

  async execute(input: { name: string; slug?: string }): Promise<VerticalRecord> {
    const name = normalizeName(input.name);
    if (!isValidName(name)) {
      throw new TaxonomyError('INVALID_NAME', 'El nombre debe tener entre 2 y 60 caracteres');
    }

    const slug = resolveSlug(name, input.slug);
    if (!slug) {
      throw new TaxonomyError(
        'INVALID_SLUG',
        'El slug debe estar en minúsculas y separado por guiones',
      );
    }

    const [slugTaken, nameTaken] = await Promise.all([
      this.repository.existsVerticalSlug(slug),
      this.repository.existsVerticalName(name),
    ]);
    if (slugTaken || nameTaken) {
      throw new TaxonomyError('DUPLICATE_VERTICAL', 'Ya existe una vertical con ese nombre o slug');
    }

    return this.repository.createVertical({ name, slug });
  }
}

@Injectable()
export class CreateCategoryUseCase {
  constructor(@Inject(TAXONOMY_REPOSITORY) private readonly repository: TaxonomyRepository) {}

  async execute(input: {
    verticalId: string;
    name: string;
    slug?: string;
    parentId?: string;
  }): Promise<CategoryRecord> {
    const vertical = await this.repository.findVerticalById(input.verticalId);
    if (!vertical) {
      throw new TaxonomyError('VERTICAL_NOT_FOUND', 'La vertical no existe');
    }

    const name = normalizeName(input.name);
    if (!isValidName(name)) {
      throw new TaxonomyError('INVALID_NAME', 'El nombre debe tener entre 2 y 60 caracteres');
    }

    const slug = resolveSlug(name, input.slug);
    if (!slug) {
      throw new TaxonomyError(
        'INVALID_SLUG',
        'El slug debe estar en minúsculas y separado por guiones',
      );
    }

    if (input.parentId) {
      const parent = await this.repository.findCategoryById(input.parentId);
      if (!parent) {
        throw new TaxonomyError('CATEGORY_NOT_FOUND', 'La categoría padre no existe');
      }
      if (parent.verticalId !== input.verticalId) {
        throw new TaxonomyError(
          'PARENT_VERTICAL_MISMATCH',
          'La categoría padre pertenece a otra vertical',
        );
      }

      const ancestors = await this.repository.listAncestors(parent.id);
      if (ancestors.length >= MAX_HIERARCHY_DEPTH) {
        throw new TaxonomyError('PARENT_CYCLE', 'La jerarquía de categorías es demasiado profunda');
      }
    }

    if (await this.repository.existsCategorySlug(input.verticalId, slug)) {
      throw new TaxonomyError(
        'DUPLICATE_CATEGORY',
        'Ya existe una categoría con ese slug en la vertical',
      );
    }

    return this.repository.createCategory({
      verticalId: input.verticalId,
      name,
      slug,
      parentId: input.parentId ?? null,
    });
  }
}

@Injectable()
export class CreateAttributeUseCase {
  constructor(@Inject(TAXONOMY_REPOSITORY) private readonly repository: TaxonomyRepository) {}

  async execute(input: {
    categoryId: string;
    name: string;
    code: string;
    type: string;
    isRequired?: boolean;
    isFilterable?: boolean;
    options?: string[];
  }): Promise<AttributeRecord> {
    const category = await this.repository.findCategoryById(input.categoryId);
    if (!category) {
      throw new TaxonomyError('CATEGORY_NOT_FOUND', 'La categoría no existe');
    }

    const name = normalizeName(input.name);
    if (!isValidName(name)) {
      throw new TaxonomyError('INVALID_NAME', 'El nombre debe tener entre 2 y 60 caracteres');
    }

    const code = normalizeCode(input.code);
    if (!code) {
      throw new TaxonomyError(
        'INVALID_CODE',
        'El code debe estar en minúsculas y separado por guiones',
      );
    }

    if (!isAttributeType(input.type)) {
      throw new TaxonomyError('INVALID_TYPE', 'El tipo debe ser TEXT, NUMBER, BOOLEAN o ENUM');
    }

    const rawOptions = input.options ?? [];
    if (input.type !== 'ENUM' && rawOptions.length > 0) {
      throw new TaxonomyError('INVALID_OPTIONS', 'Solo los atributos ENUM admiten opciones');
    }
    if (input.type === 'ENUM' && rawOptions.length === 0) {
      throw new TaxonomyError('INVALID_OPTIONS', 'Un atributo ENUM necesita al menos una opción');
    }

    const normalized = normalizeOptions(rawOptions);
    if (!normalized.ok) {
      const reason =
        normalized.reason === 'DUPLICATE'
          ? 'Las opciones no pueden repetirse'
          : normalized.reason === 'EMPTY'
            ? 'Las opciones no pueden estar vacías'
            : 'Cada opción debe tener 60 caracteres como máximo';
      throw new TaxonomyError('INVALID_OPTIONS', reason);
    }
    if (!validateOptionsForType(input.type, normalized.options)) {
      throw new TaxonomyError('INVALID_OPTIONS', 'Opciones incompatibles con el tipo del atributo');
    }

    if (await this.repository.existsAttributeCode(input.categoryId, code)) {
      throw new TaxonomyError(
        'DUPLICATE_CODE',
        'Ya existe un atributo con ese code en la categoría',
      );
    }

    return this.repository.createAttribute({
      categoryId: input.categoryId,
      name,
      code,
      type: input.type,
      isRequired: input.isRequired ?? false,
      isFilterable: input.isFilterable ?? true,
      options: normalized.options,
    });
  }
}
