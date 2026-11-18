import { Module } from '@nestjs/common';

import { ListingsModule } from '../listings/listings.module.js';
import { PUBLIC_CATALOG_REPOSITORY } from './application/tokens.js';
import {
  GetPublicBusinessUseCase,
  GetPublicListingUseCase,
  GetPublicSitemapUseCase,
  GetPublicVerticalUseCase,
  ListPublicVerticalsUseCase,
  SearchPublicListingsUseCase,
} from './application/public-catalog.use-cases.js';
import { PrismaPublicCatalogRepository } from './infrastructure/prisma-public-catalog.repository.js';
import { PublicCatalogController } from './infrastructure/public-catalog.controller.js';
import { PublicRateLimitGuard } from './infrastructure/public-rate-limit.guard.js';

/**
 * Catálogo público: consultas agregadas de solo lectura sobre las publicaciones
 * existentes. No posee inventario ni duplica datos de negocio.
 */
@Module({
  imports: [ListingsModule],
  controllers: [PublicCatalogController],
  providers: [
    ListPublicVerticalsUseCase,
    GetPublicVerticalUseCase,
    SearchPublicListingsUseCase,
    GetPublicListingUseCase,
    GetPublicBusinessUseCase,
    GetPublicSitemapUseCase,
    PublicRateLimitGuard,
    { provide: PUBLIC_CATALOG_REPOSITORY, useClass: PrismaPublicCatalogRepository },
  ],
})
export class PublicCatalogModule {}
