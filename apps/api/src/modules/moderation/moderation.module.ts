import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { PublicCatalogModule } from '../public-catalog/public-catalog.module.js';
import {
  ArchiveListingUseCase,
  GetModerationSummaryUseCase,
  GetReportUseCase,
  ListReportsUseCase,
  SubmitPublicReportUseCase,
  SuspendBusinessUseCase,
  UpdateReportStatusUseCase,
} from './application/moderation.use-cases.js';
import {
  IP_HASH_SECRET,
  MODERATION_REPOSITORY,
  REPORT_RATE_LIMITER,
} from './application/tokens.js';
import { AdminReportsController } from './infrastructure/admin-reports.controller.js';
import { PrismaModerationRepository } from './infrastructure/prisma-moderation.repository.js';
import { PublicReportController } from './infrastructure/public-report.controller.js';
import { InMemoryReportRateLimiter } from './infrastructure/report-rate-limiter.js';
import { OptionalSessionGuard } from './infrastructure/optional-session.guard.js';

@Module({
  imports: [AuthModule, PublicCatalogModule],
  controllers: [PublicReportController, AdminReportsController],
  providers: [
    RolesGuard,
    OptionalSessionGuard,
    SubmitPublicReportUseCase,
    ListReportsUseCase,
    GetReportUseCase,
    UpdateReportStatusUseCase,
    SuspendBusinessUseCase,
    ArchiveListingUseCase,
    GetModerationSummaryUseCase,
    { provide: MODERATION_REPOSITORY, useClass: PrismaModerationRepository },
    { provide: REPORT_RATE_LIMITER, useClass: InMemoryReportRateLimiter },
    {
      provide: IP_HASH_SECRET,
      inject: [ConfigService],
      useFactory: (config: ConfigService): string =>
        config.get<string>('IP_HASH_SECRET') ?? 'dev-ip-hash-secret',
    },
  ],
})
export class ModerationModule {}
