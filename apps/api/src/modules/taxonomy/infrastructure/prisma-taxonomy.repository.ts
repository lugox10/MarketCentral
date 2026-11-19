import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service.js';
import { TaxonomyError, type TaxonomyErrorCode } from '../domain/taxonomy-error.js';
import type {
  AttributeOptionRecord,
  AttributePatch,
  AttributeRecord,
  CategoryPatch,
  CategoryRecord,
  CreateAttributeInput,
  CreateCategoryInput,
  CreateVerticalInput,
  OptionPatch,
  ParentLink,
  TaxonomyRepository,
  VerticalPatch,
  VerticalRecord,
} from '../application/ports.js';
import type { AttributeType } from '../domain/taxonomy.js';

/**
 * Adaptador Prisma del puerto `TaxonomyRepository`.
 *
 * Prisma solo aparece aquí: los casos de uso y el dominio no lo conocen.
 */
@Injectable()
export class PrismaTaxonomyRepository implements TaxonomyRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listVerticals(includeInactive: boolean): Promise<VerticalRecord[]> {
    return this.prisma.vertical.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async listCategoriesByVertical(
    verticalId: string,
    includeInactive: boolean,
  ): Promise<CategoryRecord[]> {
    return this.prisma.category.findMany({
      where: { verticalId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });
  }

  async listAttributesByCategory(
    categoryId: string,
    includeInactive: boolean,
  ): Promise<AttributeRecord[]> {
    const rows = await this.prisma.attributeDefinition.findMany({
      where: { categoryId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: 'asc' },
      include: {
        options: {
          where: includeInactive ? {} : { isActive: true },
          orderBy: { value: 'asc' },
        },
      },
    });

    return rows.map(toAttributeRecord);
  }

  async findVerticalById(id: string): Promise<VerticalRecord | null> {
    return this.prisma.vertical.findUnique({ where: { id } });
  }

  async findCategoryById(id: string): Promise<CategoryRecord | null> {
    return this.prisma.category.findUnique({ where: { id } });
  }

  async findAttributeById(id: string): Promise<AttributeRecord | null> {
    const row = await this.prisma.attributeDefinition.findUnique({
      where: { id },
      include: { options: { orderBy: { value: 'asc' } } },
    });

    return row ? toAttributeRecord(row) : null;
  }

  async findOptionById(id: string): Promise<AttributeOptionRecord | null> {
    const row = await this.prisma.attributeOption.findUnique({
      where: { id },
      select: { id: true, value: true, isActive: true },
    });

    return row ?? null;
  }

  async listAncestors(categoryId: string): Promise<ParentLink[]> {
    const chain: ParentLink[] = [];
    let current: string | null = categoryId;

    while (current) {
      const row: { id: string; parentId: string | null } | null =
        await this.prisma.category.findUnique({
          where: { id: current },
          select: { id: true, parentId: true },
        });
      if (!row) break;

      chain.push({ id: row.id, parentId: row.parentId });
      if (chain.length > 100) break;
      current = row.parentId;
    }

    return chain;
  }

  async existsVerticalSlug(slug: string): Promise<boolean> {
    const row = await this.prisma.vertical.findUnique({ where: { slug }, select: { id: true } });
    return row !== null;
  }

  async existsVerticalName(name: string): Promise<boolean> {
    const row = await this.prisma.vertical.findUnique({ where: { name }, select: { id: true } });
    return row !== null;
  }

  async existsCategorySlug(verticalId: string, slug: string): Promise<boolean> {
    const row = await this.prisma.category.findFirst({
      where: { verticalId, slug, businessId: null },
      select: { id: true },
    });
    return row !== null;
  }

  async existsAttributeCode(categoryId: string, code: string): Promise<boolean> {
    const row = await this.prisma.attributeDefinition.findUnique({
      where: { categoryId_code: { categoryId, code } },
      select: { id: true },
    });
    return row !== null;
  }

  async createVertical(input: CreateVerticalInput): Promise<VerticalRecord> {
    try {
      return await this.prisma.vertical.create({ data: { name: input.name, slug: input.slug } });
    } catch (error) {
      throw mapUniqueViolation(
        error,
        'DUPLICATE_VERTICAL',
        'Ya existe una vertical con ese nombre o slug',
      );
    }
  }

  async createCategory(input: CreateCategoryInput): Promise<CategoryRecord> {
    try {
      return await this.prisma.category.create({
        data: {
          verticalId: input.verticalId,
          name: input.name,
          slug: input.slug,
          parentId: input.parentId,
        },
      });
    } catch (error) {
      throw mapUniqueViolation(
        error,
        'DUPLICATE_CATEGORY',
        'Ya existe una categoría con ese slug en la vertical',
      );
    }
  }

  /**
   * Crea el atributo y sus opciones en una sola transacción: si una opción
   * falla, no queda un `AttributeDefinition` a medias.
   */
  async createAttribute(input: CreateAttributeInput): Promise<AttributeRecord> {
    let row;
    try {
      row = await this.prisma.attributeDefinition.create({
        data: {
          categoryId: input.categoryId,
          name: input.name,
          code: input.code,
          type: input.type,
          isRequired: input.isRequired,
          isFilterable: input.isFilterable,
          options: { create: input.options.map((value) => ({ value })) },
        },
        include: { options: { orderBy: { value: 'asc' } } },
      });
    } catch (error) {
      throw mapUniqueViolation(
        error,
        'DUPLICATE_CODE',
        'Ya existe un atributo con ese code en la categoría',
      );
    }

    return toAttributeRecord(row);
  }

  async updateVertical(id: string, patch: VerticalPatch): Promise<VerticalRecord> {
    try {
      return await this.prisma.vertical.update({ where: { id }, data: patch });
    } catch (error) {
      throw mapUniqueViolation(
        error,
        'DUPLICATE_VERTICAL',
        'Ya existe una vertical con ese nombre',
      );
    }
  }

  async updateCategory(id: string, patch: CategoryPatch): Promise<CategoryRecord> {
    return this.prisma.category.update({ where: { id }, data: patch });
  }

  async updateAttribute(id: string, patch: AttributePatch): Promise<AttributeRecord> {
    const row = await this.prisma.attributeDefinition.update({
      where: { id },
      data: patch,
      include: { options: { orderBy: { value: 'asc' } } },
    });

    return toAttributeRecord(row);
  }

  async updateOption(id: string, patch: OptionPatch): Promise<AttributeOptionRecord> {
    try {
      return await this.prisma.attributeOption.update({
        where: { id },
        data: patch,
        select: { id: true, value: true, isActive: true },
      });
    } catch (error) {
      throw mapUniqueViolation(
        error,
        'INVALID_INPUT',
        'Ya existe una opción con ese valor en el atributo',
      );
    }
  }
}

type AttributeRow = {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  type: string;
  isRequired: boolean;
  isFilterable: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  options: Array<{ id: string; value: string; isActive: boolean }>;
};

function toAttributeRecord(row: AttributeRow): AttributeRecord {
  return {
    id: row.id,
    categoryId: row.categoryId,
    name: row.name,
    code: row.code,
    type: row.type as AttributeType,
    isRequired: row.isRequired,
    isFilterable: row.isFilterable,
    isActive: row.isActive,
    options: row.options.map((option) => ({
      id: option.id,
      value: option.value,
      isActive: option.isActive,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Convierte una violación de unicidad de PostgreSQL en un error de dominio. */
function mapUniqueViolation(error: unknown, code: TaxonomyErrorCode, message: string): unknown {
  if (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  ) {
    return new TaxonomyError(code, message);
  }

  return error;
}
