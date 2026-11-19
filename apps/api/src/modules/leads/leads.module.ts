import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { PublicCatalogModule } from '../public-catalog/public-catalog.module.js';
import {
  GetLeadUseCase,
  GetLeadsSummaryUseCase,
  IssueFormTokenUseCase,
  ListLeadsUseCase,
  SubmitPublicLeadUseCase,
  UpdateLeadStatusUseCase,
} from './application/lead.use-cases.js';
import {
  FORM_TOKEN_SECRET,
  IP_HASH_SECRET,
  LEAD_RATE_LIMITER,
  LEAD_REPOSITORY,
} from './application/tokens.js';
import { InMemoryRateLimiter } from './infrastructure/lead-rate-limiter.js';
import { LeadController } from './infrastructure/lead.controller.js';
import { PrismaLeadRepository } from './infrastructure/prisma-lead.repository.js';
import { PublicLeadController } from './infrastructure/public-lead.controller.js';

/**
 * Leads: contacto del comprador con el negocio. El negocio solo gestiona el
 * estado; la conversación real ocurre fuera de la plataforma.
 */
@Module({
  imports: [AuthModule, BusinessesModule, PublicCatalogModule],
  controllers: [PublicLeadController, LeadController],
  providers: [
    IssueFormTokenUseCase,
    SubmitPublicLeadUseCase,
    ListLeadsUseCase,
    GetLeadUseCase,
    UpdateLeadStatusUseCase,
    GetLeadsSummaryUseCase,
    {
      provide: IP_HASH_SECRET,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('IP_HASH_SECRET') ?? 'dev-ip-hash-secret',
    },
    {
      provide: FORM_TOKEN_SECRET,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('FORM_TOKEN_SECRET') ??
        config.get<string>('IP_HASH_SECRET') ??
        'dev-form-token-secret',
    },
    { provide: LEAD_REPOSITORY, useClass: PrismaLeadRepository },
    { provide: LEAD_RATE_LIMITER, useClass: InMemoryRateLimiter },
  ],
  exports: [LEAD_REPOSITORY],
})
export class LeadsModule {}
