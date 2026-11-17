import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import {
  CreateAttributeUseCase,
  CreateCategoryUseCase,
  CreateVerticalUseCase,
} from './application/create.use-cases.js';
import {
  ListActiveVerticalsUseCase,
  ListAttributesUseCase,
  ListCategoriesUseCase,
} from './application/queries.use-cases.js';
import { TAXONOMY_REPOSITORY } from './application/tokens.js';
import { AdminTaxonomyController } from './infrastructure/admin-taxonomy.controller.js';
import { PrismaTaxonomyRepository } from './infrastructure/prisma-taxonomy.repository.js';
import { TaxonomyController } from './infrastructure/taxonomy.controller.js';

/**
 * Taxonomía global (E3): verticales, categorías y atributos configurables.
 * No conoce publicaciones ni inventario: eso llega en E5.
 */
@Module({
  imports: [AuthModule],
  controllers: [TaxonomyController, AdminTaxonomyController],
  providers: [
    ListActiveVerticalsUseCase,
    ListCategoriesUseCase,
    ListAttributesUseCase,
    CreateVerticalUseCase,
    CreateCategoryUseCase,
    CreateAttributeUseCase,
    { provide: TAXONOMY_REPOSITORY, useClass: PrismaTaxonomyRepository },
  ],
  exports: [TAXONOMY_REPOSITORY],
})
export class TaxonomyModule {}
