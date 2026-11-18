import { Inject, Injectable } from '@nestjs/common';

import { slugify, isValidSlug } from '../../../common/utils/slug.js';
import { CategoryError } from '../domain/category-error.js';
import { PLAN_FEATURE_HINTS } from '../domain/business.js';
import { BUSINESS_CATEGORY_REPOSITORY, BUSINESS_REPOSITORY } from './tokens.js';
import type { BusinessContext, BusinessCategoryRepository, BusinessRepository } from './ports.js';

const NAME_MIN = 2;
const NAME_MAX = 60;

export interface BusinessCategoryView {
  items: Awaited<ReturnType<BusinessCategoryRepository['listByBusiness']>>;
  used: number;
  limit: number;
  remaining: number;
  canCreate: boolean;
  planCode: string;
  upgradeHint: string;
}

export interface CreateBusinessCategoryCommand {
  userId: string;
  name: string;
  parentId?: string | null;
}

export interface UpdateBusinessCategoryCommand {
  userId: string;
  categoryId: string;
  name?: string;
  isActive?: boolean;
}

function normalizeName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    throw new CategoryError(
      'INVALID_CATEGORY_NAME',
      `El nombre debe tener entre ${NAME_MIN} y ${NAME_MAX} caracteres`,
    );
  }
  return name;
}

/**
 * Categorías propias del negocio.
 *
 * Reglas de negocio (D-40): el cupo del plan se cuenta sobre categorías
 * **activas**; 0 significa que el plan no permite crear ninguna y la UI debe
 * mostrar la invitación a mejorar; desactivar una categoría libera el cupo
 * pero la deja visible para el negocio (no se borra nunca).
 */
@Injectable()
export class ListBusinessCategoriesUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository,
    @Inject(BUSINESS_CATEGORY_REPOSITORY)
    private readonly categories: BusinessCategoryRepository,
  ) {}

  async execute(userId: string): Promise<BusinessCategoryView> {
    const context = await this.requireContext(userId);
    const limit = context.subscription?.plan.maxCategories ?? 0;
    const [items, used] = await Promise.all([
      this.categories.listByBusiness(context.business.id),
      this.categories.countActiveByBusiness(context.business.id),
    ]);
    return {
      items,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      canCreate: limit > 0 && used < limit,
      planCode: context.subscription?.plan.code ?? 'FREE',
      upgradeHint: PLAN_FEATURE_HINTS.categories,
    };
  }

  private async requireContext(userId: string): Promise<BusinessContext> {
    const context = await this.businesses.findByUserId(userId);
    if (!context) {
      throw new CategoryError('CATEGORY_NOT_FOUND', 'Todavía no tienes un negocio');
    }
    return context;
  }
}

@Injectable()
export class CreateBusinessCategoryUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository,
    @Inject(BUSINESS_CATEGORY_REPOSITORY)
    private readonly categories: BusinessCategoryRepository,
    private readonly listCategories: ListBusinessCategoriesUseCase,
  ) {}

  async execute(command: CreateBusinessCategoryCommand): Promise<BusinessCategoryView> {
    const context = await this.businesses.findByUserId(command.userId);
    if (!context) {
      throw new CategoryError('CATEGORY_NOT_FOUND', 'Todavía no tienes un negocio');
    }

    const business = context.business;
    const limit = context.subscription?.plan.maxCategories ?? 0;
    const name = normalizeName(command.name);
    const slug = slugify(name);
    if (!isValidSlug(slug)) {
      throw new CategoryError(
        'INVALID_CATEGORY_NAME',
        'El nombre debe incluir al menos una letra o número',
      );
    }

    let parentId: string | null = null;
    if (command.parentId) {
      const parent = await this.categories.findById(command.parentId);
      if (!parent || parent.verticalId !== business.verticalId || !parent.isActive) {
        throw new CategoryError(
          'INVALID_CATEGORY_PARENT',
          'La categoría padre debe ser de tu misma vertical y estar activa',
        );
      }
      if (parent.businessId !== null && parent.businessId !== business.id) {
        throw new CategoryError(
          'INVALID_CATEGORY_PARENT',
          'La categoría padre pertenece a otro negocio',
        );
      }
      parentId = parent.id;
    }

    if (limit === 0) {
      throw new CategoryError(
        'CATEGORY_LIMIT_REACHED',
        'Tu plan no incluye categorías propias; mejora el plan para crearlas',
      );
    }

    const used = await this.categories.countActiveByBusiness(business.id);
    if (used >= limit) {
      throw new CategoryError(
        'CATEGORY_LIMIT_REACHED',
        `Ya usas las ${limit} categorías propias de tu plan`,
      );
    }

    if (await this.categories.existsSlug(business.id, slug)) {
      throw new CategoryError('DUPLICATE_CATEGORY', 'Ya tienes una categoría con ese nombre');
    }

    await this.categories.create({
      verticalId: business.verticalId,
      businessId: business.id,
      parentId,
      name,
      slug,
    });

    return this.listCategories.execute(command.userId);
  }
}

@Injectable()
export class UpdateBusinessCategoryUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository,
    @Inject(BUSINESS_CATEGORY_REPOSITORY)
    private readonly categories: BusinessCategoryRepository,
    private readonly listCategories: ListBusinessCategoriesUseCase,
  ) {}

  async execute(command: UpdateBusinessCategoryCommand): Promise<BusinessCategoryView> {
    const context = await this.businesses.findByUserId(command.userId);
    if (!context) {
      throw new CategoryError('CATEGORY_NOT_FOUND', 'Todavía no tienes un negocio');
    }
    if (command.name === undefined && command.isActive === undefined) {
      throw new CategoryError('INVALID_INPUT', 'Indica el nombre o el estado a cambiar');
    }

    const category = await this.categories.findById(command.categoryId);
    if (!category) {
      throw new CategoryError('CATEGORY_NOT_FOUND', 'La categoría no existe');
    }
    if (category.businessId !== context.business.id) {
      throw new CategoryError('CATEGORY_NOT_OWNED', 'La categoría pertenece a otro negocio');
    }

    if (command.name !== undefined) {
      const name = normalizeName(command.name);
      const slug = slugify(name);
      if (!isValidSlug(slug)) {
        throw new CategoryError(
          'INVALID_CATEGORY_NAME',
          'El nombre debe incluir al menos una letra o número',
        );
      }
      if (slug !== category.slug && (await this.categories.existsSlug(context.business.id, slug))) {
        throw new CategoryError('DUPLICATE_CATEGORY', 'Ya tienes una categoría con ese nombre');
      }
      await this.categories.rename(category.id, name, slug);
    }

    if (command.isActive !== undefined && command.isActive !== category.isActive) {
      if (command.isActive) {
        const limit = context.subscription?.plan.maxCategories ?? 0;
        const used = await this.categories.countActiveByBusiness(context.business.id);
        if (used >= limit) {
          throw new CategoryError(
            'CATEGORY_LIMIT_REACHED',
            `Tu plan permite ${limit} categorías propias activas`,
          );
        }
      } else {
        const published = await this.categories.countPublishedListings(category.id);
        if (published > 0) {
          throw new CategoryError(
            'CATEGORY_HAS_LISTINGS',
            'Mueve o archiva las publicaciones de esta categoría antes de desactivarla',
          );
        }
      }
      await this.categories.setActive(category.id, command.isActive);
    }

    return this.listCategories.execute(command.userId);
  }
}
