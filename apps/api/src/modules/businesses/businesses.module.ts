import { Module } from '@nestjs/common';

import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import {
  ListBusinessesUseCase,
  UpdateBusinessStatusUseCase,
} from './application/admin.use-cases.js';
import { GetMyBusinessUseCase, UpdateBusinessUseCase } from './application/business.use-cases.js';
import {
  ClearBusinessImageUseCase,
  SetBusinessImageUseCase,
} from './application/business-image.use-cases.js';
import {
  CreateBusinessCategoryUseCase,
  ListBusinessCategoriesUseCase,
  UpdateBusinessCategoryUseCase,
} from './application/category.use-cases.js';
import { CreateBusinessUseCase } from './application/create-business.use-case.js';
import {
  BUSINESS_CATEGORY_REPOSITORY,
  BUSINESS_REPOSITORY,
  PLAN_REPOSITORY,
} from './application/tokens.js';
import { AdminBusinessesController } from './infrastructure/admin-businesses.controller.js';
import { BusinessCategoryController } from './infrastructure/business-category.controller.js';
import { BusinessController } from './infrastructure/business.controller.js';
import { PrismaBusinessCategoryRepository } from './infrastructure/prisma-business-category.repository.js';
import {
  PrismaBusinessRepository,
  PrismaPlanRepository,
} from './infrastructure/prisma-business.repository.js';

/**
 * Módulo Businesses (E2/E5): negocio, membresías, suscripción base y
 * categorías propias del negocio.
 *
 * `AuthModule` se importa para reutilizar `SessionGuard`; los puertos de
 * persistencia se enlazan a sus adaptadores Prisma.
 */
@Module({
  imports: [AuthModule],
  controllers: [BusinessController, BusinessCategoryController, AdminBusinessesController],
  providers: [
    CreateBusinessUseCase,
    GetMyBusinessUseCase,
    UpdateBusinessUseCase,
    SetBusinessImageUseCase,
    ClearBusinessImageUseCase,
    ListBusinessesUseCase,
    UpdateBusinessStatusUseCase,
    ListBusinessCategoriesUseCase,
    CreateBusinessCategoryUseCase,
    UpdateBusinessCategoryUseCase,
    RolesGuard,
    { provide: BUSINESS_REPOSITORY, useClass: PrismaBusinessRepository },
    { provide: PLAN_REPOSITORY, useClass: PrismaPlanRepository },
    { provide: BUSINESS_CATEGORY_REPOSITORY, useClass: PrismaBusinessCategoryRepository },
  ],
  exports: [BUSINESS_REPOSITORY, BUSINESS_CATEGORY_REPOSITORY],
})
export class BusinessesModule {}
