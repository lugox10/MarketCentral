import { Module } from '@nestjs/common';

import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import {
  ActivateSubscriptionUseCase,
  AdjustTrialUseCase,
  GetMySubscriptionUseCase,
  GetSubscriptionHistoryUseCase,
  ListAdminSubscriptionsUseCase,
  ListPlansUseCase,
  SendExpiryRemindersUseCase,
  UpdatePlanUseCase,
} from './application/subscription.use-cases.js';
import { SUBSCRIPTION_REPOSITORY } from './application/tokens.js';
import {
  AdminPlansController,
  AdminSubscriptionController,
} from './infrastructure/admin-subscription.controller.js';
import { ExpiryReminderJob } from './infrastructure/expiry-reminder.job.js';
import { PrismaSubscriptionRepository } from './infrastructure/prisma-subscription.repository.js';
import { SubscriptionController } from './infrastructure/subscription.controller.js';

/**
 * Módulo Subscriptions (E4/E5): planes, suscripción del negocio, activación
 * manual, ajuste de prueba, historial y aviso diario de vencimiento.
 *
 * Depende de `BusinessesModule` en una sola dirección (lee el negocio del
 * actor a través de `BUSINESS_REPOSITORY`); Businesses no conoce Subscriptions.
 */
@Module({
  imports: [AuthModule, BusinessesModule],
  controllers: [SubscriptionController, AdminSubscriptionController, AdminPlansController],
  providers: [
    ListPlansUseCase,
    GetMySubscriptionUseCase,
    ListAdminSubscriptionsUseCase,
    GetSubscriptionHistoryUseCase,
    ActivateSubscriptionUseCase,
    UpdatePlanUseCase,
    AdjustTrialUseCase,
    SendExpiryRemindersUseCase,
    ExpiryReminderJob,
    RolesGuard,
    { provide: SUBSCRIPTION_REPOSITORY, useClass: PrismaSubscriptionRepository },
  ],
  exports: [SUBSCRIPTION_REPOSITORY],
})
export class SubscriptionsModule {}
