import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { LISTING_REPOSITORY, MEDIA_STORAGE } from '../application/tokens.js';
import type { ListingRepository, MediaStorage } from '../application/ports.js';

/** Días que se conservan las fotos de una publicación archivada antes de purgarlas. */
export function purgeArchivedAfterDays(): number {
  const raw = Number(process.env.MEDIA_PURGE_ARCHIVED_DAYS ?? 90);
  return Number.isFinite(raw) && raw >= 7 ? Math.floor(raw) : 90;
}

/**
 * Purga las fotos de publicaciones archivadas.
 *
 * Regla de negocio: mientras una publicación está en borrador, publicada o
 * vendida, sus fotos se conservan aunque la suscripción esté vencida; archivar
 * es definitivo y sus fotos dejan de tener sentido. Se borran primero los
 * objetos del almacenamiento y después las filas, de modo que un fallo a mitad
 * deja filas huérfanas (recuperables) en vez de objetos sin referencia.
 */
@Injectable()
export class MediaCleanupService {
  private readonly logger = new Logger(MediaCleanupService.name);
  private readonly batchSize = 200;

  constructor(
    @Inject(LISTING_REPOSITORY) private readonly listings: ListingRepository,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  /** Ejecuta una pasada; devuelve cuántas imágenes se borraron. */
  async run(now: Date = new Date()): Promise<number> {
    const days = purgeArchivedAfterDays();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    let deleted = 0;

    for (;;) {
      const batch = await this.listings.listArchivedImagesBefore(cutoff, this.batchSize);
      if (batch.length === 0) break;

      for (const image of batch) {
        try {
          await this.storage.delete(image.storageKey);
        } catch (error) {
          this.logger.warn(
            `No se pudo borrar el objeto ${image.storageKey}; se conserva la fila: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          continue;
        }
        await this.listings.deleteImages([image.id]);
        deleted += 1;
      }

      if (batch.length < this.batchSize) break;
    }

    if (deleted > 0) this.logger.log(`Purga de medios: ${deleted} imágenes archivadas eliminadas`);
    return deleted;
  }

  @Cron('0 3 * * *', {
    name: 'media-cleanup',
    disabled: process.env.NODE_ENV === 'test' || process.env.MEDIA_PURGE_ENABLED === 'false',
  })
  async handleCron(): Promise<void> {
    try {
      await this.run();
    } catch (error) {
      this.logger.error(
        `Falló la purga de medios: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
