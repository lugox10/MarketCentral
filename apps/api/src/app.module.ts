import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { validateEnv } from './config/env.validation.js';
import { MediaModule } from './common/media/media.module.js';
import { OutboxModule } from './modules/outbox/outbox.module.js';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BusinessesModule } from './modules/businesses/businesses.module.js';
import { ListingsModule } from './modules/listings/listings.module.js';
import { PublicCatalogModule } from './modules/public-catalog/public-catalog.module.js';
import { LeadsModule } from './modules/leads/leads.module.js';
import { ModerationModule } from './modules/moderation/moderation.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module.js';
import { TaxonomyModule } from './modules/taxonomy/taxonomy.module.js';

/**
 * Módulo raíz del monolito modular.
 *
 * E1 añade identidad y sesiones (`AuthModule`) sobre el mismo proceso: los jobs
 * de mantenimiento siguen viviendo aquí (`@nestjs/schedule`), no hay worker.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: ['../../.env.local', '../../.env', '.env.local', '.env'],
    }),
    // Los jobs corren dentro de este proceso (ADR-001, Opción B): no hay worker.
    ScheduleModule.forRoot(),
    PrismaModule,
    MediaModule,
    OutboxModule,
    AuthModule,
    BusinessesModule,
    SubscriptionsModule,
    TaxonomyModule,
    ListingsModule,
    PublicCatalogModule,
    LeadsModule,
    ModerationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
