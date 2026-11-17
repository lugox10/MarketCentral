import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service.js';
import { TaxonomyError, type TaxonomyErrorCode } from '../domain/taxonomy-error.js';
import type {
  AttributeRecord,
  CategoryRecord,
  CreateAttributeInput,
  CreateCategoryInput,
  CreateVerticalInput,
  ParentLink,
  TaxonomyRepository,
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

  async listActiveVerticals(): Promise<VerticalRecord[]> {
    return this.prisma.vertical.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async listCategoriesByVertical(verticalId: string): Promise<CategoryRecord[]> {
    return this.prisma.category.findMany({
      where: { verticalId },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });
  }

  async listAttributesByCategory(categoryId: string): Promise<AttributeRecord[]> {
    const rows = await this.prisma.attributeDefinition.findMany({
      where: { categoryId },
      orderBy: { name: 'asc' },
      include: { options: { orderBy: { value: 'asc' } } },
    });

    return rows.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      name: row.name,
      code: row.code,
      type: row.type as AttributeType,
      isRequired: row.isRequired,
      isFilterable: row.isFilterable,
      options: row.options.map((option) => ({ id: option.id, value: option.value })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async findVerticalById(id: string): Promise<VerticalRecord | null> {
    return this.prisma.vertical.findUnique({ where: { id } });
  }

  async findCategoryById(id: string): Promise<CategoryRecord | null> {
    return this.prisma.category.findUnique({ where: { id } });
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
    const row = await this.prisma.category.findUnique({
      where: { verticalId_slug: { verticalId, slug } },
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

    return {
      id: row.id,
      categoryId: row.categoryId,
      name: row.name,
      code: row.code,
      type: row.type as AttributeType,
      isRequired: row.isRequired,
      isFilterable: row.isFilterable,
      options: row.options.map((option) => ({ id: option.id, value: option.value })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
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
