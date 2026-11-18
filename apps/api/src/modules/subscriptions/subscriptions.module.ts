import { Module } from '@nestjs/common';

import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import {
  ActivateSubscriptionUseCase,
  GetMySubscriptionUseCase,
  GetSubscriptionHistoryUseCase,
  ListAdminSubscriptionsUseCase,
  ListPlansUseCase,
} from './application/subscription.use-cases.js';
import { SUBSCRIPTION_REPOSITORY } from './application/tokens.js';
import { AdminSubscriptionController } from './infrastructure/admin-subscription.controller.js';
import { PrismaSubscriptionRepository } from './infrastructure/prisma-subscription.repository.js';
import { SubscriptionController } from './infrastructure/subscription.controller.js';

/**
 * Módulo Subscriptions (E4): planes, suscripción del negocio, activación
 * manual e historial.
 *
 * Depende de `BusinessesModule` en una sola dirección (lee el negocio del
 * actor a través de `BUSINESS_REPOSITORY`); Businesses no conoce Subscriptions.
 */
@Module({
  imports: [AuthModule, BusinessesModule],
  controllers: [SubscriptionController, AdminSubscriptionController],
  providers: [
    ListPlansUseCase,
    GetMySubscriptionUseCase,
    ListAdminSubscriptionsUseCase,
    GetSubscriptionHistoryUseCase,
    ActivateSubscriptionUseCase,
    RolesGuard,
    { provide: SUBSCRIPTION_REPOSITORY, useClass: PrismaSubscriptionRepository },
  ],
  exports: [SUBSCRIPTION_REPOSITORY],
})
export class SubscriptionsModule {}
