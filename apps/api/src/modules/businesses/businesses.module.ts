import { Module } from '@nestjs/common';

import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import {
  ListBusinessesUseCase,
  UpdateBusinessStatusUseCase,
} from './application/admin.use-cases.js';
import { GetMyBusinessUseCase, UpdateBusinessUseCase } from './application/business.use-cases.js';
import { CreateBusinessUseCase } from './application/create-business.use-case.js';
import { BUSINESS_REPOSITORY, PLAN_REPOSITORY } from './application/tokens.js';
import { AdminBusinessesController } from './infrastructure/admin-businesses.controller.js';
import { BusinessController } from './infrastructure/business.controller.js';
import {
  PrismaBusinessRepository,
  PrismaPlanRepository,
} from './infrastructure/prisma-business.repository.js';

/**
 * Módulo Businesses (E2): negocio, membresías y suscripción base.
 *
 * `AuthModule` se importa para reutilizar `SessionGuard`; los puertos de
 * persistencia se enlazan a sus adaptadores Prisma.
 */
@Module({
  imports: [AuthModule],
  controllers: [BusinessController, AdminBusinessesController],
  providers: [
    CreateBusinessUseCase,
    GetMyBusinessUseCase,
    UpdateBusinessUseCase,
    ListBusinessesUseCase,
    UpdateBusinessStatusUseCase,
    RolesGuard,
    { provide: BUSINESS_REPOSITORY, useClass: PrismaBusinessRepository },
    { provide: PLAN_REPOSITORY, useClass: PrismaPlanRepository },
  ],
  exports: [BUSINESS_REPOSITORY],
})
export class BusinessesModule {}
