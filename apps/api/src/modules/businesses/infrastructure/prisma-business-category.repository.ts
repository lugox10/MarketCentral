import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service.js';
import { CategoryError } from '../domain/category-error.js';
import type {
  BusinessCategory,
  BusinessCategoryRepository,
  CategoryParentOption,
  CreateBusinessCategoryInput,
} from '../application/ports.js';

interface CategoryRow {
  id: string;
  verticalId: string;
  businessId: string | null;
  parentId: string | null;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
}

function toCategory(row: CategoryRow): BusinessCategory {
  return {
    id: row.id,
    verticalId: row.verticalId,
    businessId: row.businessId,
    parentId: row.parentId,
    name: row.name,
    slug: row.slug,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

/**
 * Categorías propias de un negocio.
 *
 * La categoría global (`business_id IS NULL`) la administra el SUPER_ADMIN;
 * aquí solo se manipulan filas cuyo `business_id` es el negocio del actor.
 */
@Injectable()
export class PrismaBusinessCategoryRepository implements BusinessCategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByBusiness(businessId: string): Promise<BusinessCategory[]> {
    const rows = await this.prisma.category.findMany({
      where: { businessId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return rows.map(toCategory);
  }

  async findById(categoryId: string): Promise<BusinessCategory | null> {
    const row = await this.prisma.category.findUnique({ where: { id: categoryId } });
    return row ? toCategory(row) : null;
  }

  async countActiveByBusiness(businessId: string): Promise<number> {
    return this.prisma.category.count({ where: { businessId, isActive: true } });
  }

  async existsSlug(businessId: string, slug: string): Promise<boolean> {
    const row = await this.prisma.category.findFirst({
      where: { businessId, slug },
      select: { id: true },
    });
    return row !== null;
  }

  async create(input: CreateBusinessCategoryInput): Promise<BusinessCategory> {
    try {
      const row = await this.prisma.category.create({
        data: {
          verticalId: input.verticalId,
          businessId: input.businessId,
          parentId: input.parentId,
          name: input.name,
          slug: input.slug,
          isActive: true,
        },
      });
      return toCategory(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new CategoryError('DUPLICATE_CATEGORY', 'Ya tienes una categoría con ese nombre');
      }
      throw error;
    }
  }

  async setActive(categoryId: string, isActive: boolean): Promise<BusinessCategory> {
    const row = await this.prisma.category.update({ where: { id: categoryId }, data: { isActive } });
    return toCategory(row);
  }

  async rename(categoryId: string, name: string, slug: string): Promise<BusinessCategory> {
    try {
      const row = await this.prisma.category.update({
        where: { id: categoryId },
        data: { name, slug },
      });
      return toCategory(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new CategoryError('DUPLICATE_CATEGORY', 'Ya tienes una categoría con ese nombre');
      }
      throw error;
    }
  }

  /** Padres posibles: categorías globales de la vertical y propias del negocio. */
  async listParentOptions(businessId: string, verticalId: string): Promise<CategoryParentOption[]> {
    const rows = await this.prisma.category.findMany({
      where: {
        verticalId,
        isActive: true,
        OR: [{ businessId: null }, { businessId }],
      },
      orderBy: [{ businessId: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, businessId: true },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      isOwn: row.businessId !== null,
    }));
  }

  async countPublishedListings(categoryId: string): Promise<number> {
    // Las publicaciones llegan en la Fase 3; la consulta se conectará entonces.
    void categoryId;
    return 0;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}
