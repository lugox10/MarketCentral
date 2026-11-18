import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { LISTING_REPOSITORY, MEDIA_STORAGE } from './application/tokens.js';
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
import { LocalMediaStorage, resolveMediaDir } from './infrastructure/local-media-storage.js';
import { S3MediaStorage } from './infrastructure/s3-media-storage.js';
import { ListingController } from './infrastructure/listing.controller.js';
import { ListingImageController } from './infrastructure/listing-image.controller.js';
import type { MediaStorage } from './application/ports.js';

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
    {
      // S3-compatible (Cloudflare R2) cuando hay credenciales; disco local en desarrollo.
      provide: MEDIA_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MediaStorage => {
        const bucket = config.get<string>('MEDIA_S3_BUCKET');

        if (bucket) {
          return new S3MediaStorage({
            endpoint: config.get<string>('MEDIA_S3_ENDPOINT') ?? '',
            bucket,
            region: config.get<string>('MEDIA_S3_REGION') ?? 'auto',
            accessKeyId: config.get<string>('MEDIA_S3_ACCESS_KEY_ID') ?? '',
            secretAccessKey: config.get<string>('MEDIA_S3_SECRET_ACCESS_KEY') ?? '',
            publicBaseUrl: config.get<string>('MEDIA_S3_PUBLIC_BASE_URL') ?? '',
          });
        }

        return new LocalMediaStorage(resolveMediaDir(config.get<string>('MEDIA_LOCAL_DIR')));
      },
    },
  ],
  exports: [MEDIA_STORAGE],
})
export class ListingsModule {}
