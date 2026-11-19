import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  LocalMediaStorage,
  resolveMediaDir,
} from '../../modules/listings/infrastructure/local-media-storage.js';
import { S3MediaStorage } from '../../modules/listings/infrastructure/s3-media-storage.js';
import type { MediaStorage } from './media-storage.js';
import { MEDIA_STORAGE } from './media.tokens.js';

/**
 * Almacenamiento de objetos compartido por publicaciones y tiendas.
 *
 * Es `@Global` a propósito: tanto `ListingsModule` como `BusinessesModule` lo
 * necesitan y declararlo en cada uno obligaría a importar módulos entre sí
 * (ciclo Businesses ↔ Listings). Se registra una sola vez en `AppModule`.
 */
@Global()
@Module({
  providers: [
    {
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
export class MediaModule {}
