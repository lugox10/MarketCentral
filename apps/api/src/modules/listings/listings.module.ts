import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { LISTING_REPOSITORY } from './application/tokens.js';
import { MediaCleanupService } from './infrastructure/media-cleanup.job.js';
import {
  AddListingImageUseCase,
  ChangeListingStatusUseCase,
  CreateListingUseCase,
  RemoveListingImageUseCase,
  ReorderListingImagesUseCase,
  ToggleFeaturedUseCase,
  UpdateListingUseCase,
  ListingsSupport,
} from './application/use-cases.js';
import { GetMyListingUseCase, ListMyListingsUseCase } from './application/queries.use-cases.js';
import { PrismaListingRepository } from './infrastructure/prisma-listing.repository.js';
import { ListingController } from './infrastructure/listing.controller.js';
import { ListingImageController } from './infrastructure/listing-image.controller.js';

@Module({
  imports: [AuthModule, BusinessesModule],
  controllers: [ListingController, ListingImageController],
  providers: [
    ListingsSupport,
    CreateListingUseCase,
    UpdateListingUseCase,
    ChangeListingStatusUseCase,
    ToggleFeaturedUseCase,
    AddListingImageUseCase,
    RemoveListingImageUseCase,
    ReorderListingImagesUseCase,
    ListMyListingsUseCase,
    GetMyListingUseCase,
    MediaCleanupService,
    { provide: LISTING_REPOSITORY, useClass: PrismaListingRepository },
  ],
})
export class ListingsModule {}
