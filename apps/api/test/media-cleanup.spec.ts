import {
  purgeArchivedAfterDays,
  MediaCleanupService,
} from '../src/modules/listings/infrastructure/media-cleanup.job.js';
import type {
  ArchivedImageRecord,
  ListingRepository,
  MediaStorage,
} from '../src/modules/listings/application/ports.js';

function fakeRepository(images: ArchivedImageRecord[], capture?: { cutoff?: Date }) {
  const deleted: string[] = [];
  const repository = {
    listArchivedImagesBefore: async (cutoff: Date, limit: number) => {
      if (capture) capture.cutoff = cutoff;
      return images.slice(0, limit);
    },
    deleteImages: async (ids: string[]) => {
      deleted.push(...ids);
      for (const id of ids) {
        const index = images.findIndex((image) => image.id === id);
        if (index >= 0) images.splice(index, 1);
      }
    },
  } as unknown as ListingRepository;
  return { repository, deleted };
}

function fakeStorage(failOn?: string) {
  const removed: string[] = [];
  const storage = {
    delete: async (key: string) => {
      if (key === failOn) throw new Error('S3 caído');
      removed.push(key);
    },
  } as unknown as MediaStorage;
  return { storage, removed };
}

describe('MediaCleanupService', () => {
  const now = new Date('2026-11-18T03:00:00.000Z');

  it('purga solo las imágenes de publicaciones archivadas antes del corte', async () => {
    const images: ArchivedImageRecord[] = [
      { id: 'i1', listingId: 'l1', storageKey: 'listings/b1/l1/a.png' },
      { id: 'i2', listingId: 'l1', storageKey: 'listings/b1/l1/b.png' },
    ];
    const capture: { cutoff?: Date } = {};
    const { repository, deleted } = fakeRepository(images, capture);
    const { storage, removed } = fakeStorage();

    const total = await new MediaCleanupService(repository, storage).run(now);

    expect(total).toBe(2);
    expect(deleted).toEqual(['i1', 'i2']);
    expect(removed).toEqual(['listings/b1/l1/a.png', 'listings/b1/l1/b.png']);
    // 90 días por defecto: 2026-11-18 menos 90 días.
    expect(capture.cutoff?.toISOString()).toBe('2026-08-20T03:00:00.000Z');
  });

  it('conserva la fila cuando el almacenamiento falla, para reintentarla', async () => {
    const images: ArchivedImageRecord[] = [
      { id: 'i1', listingId: 'l1', storageKey: 'ok.png' },
      { id: 'i2', listingId: 'l1', storageKey: 'roto.png' },
    ];
    const { repository, deleted } = fakeRepository(images);
    const { storage } = fakeStorage('roto.png');

    const total = await new MediaCleanupService(repository, storage).run(now);

    expect(total).toBe(1);
    expect(deleted).toEqual(['i1']);
  });

  it('respeta MEDIA_PURGE_ARCHIVED_DAYS con un mínimo de 7 días', () => {
    const original = process.env.MEDIA_PURGE_ARCHIVED_DAYS;
    try {
      process.env.MEDIA_PURGE_ARCHIVED_DAYS = '30';
      expect(purgeArchivedAfterDays()).toBe(30);
      process.env.MEDIA_PURGE_ARCHIVED_DAYS = '1';
      expect(purgeArchivedAfterDays()).toBe(90);
      process.env.MEDIA_PURGE_ARCHIVED_DAYS = 'no-es-numero';
      expect(purgeArchivedAfterDays()).toBe(90);
    } finally {
      if (original === undefined) delete process.env.MEDIA_PURGE_ARCHIVED_DAYS;
      else process.env.MEDIA_PURGE_ARCHIVED_DAYS = original;
    }
  });
});
