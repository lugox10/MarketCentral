import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import type { MediaStorage } from '../application/ports.js';

/** Directorio absoluto usado por el adaptador local (también lo sirve `main.ts`). */
export function resolveMediaDir(configured?: string): string {
  return resolve(configured ?? process.env.MEDIA_LOCAL_DIR ?? '.var/media');
}

/**
 * Adaptador local del puerto `MediaStorage` para desarrollo y pruebas: escribe
 * los bytes en disco y los sirve el propio backend. En producción se usa el
 * adaptador S3/R2; el dominio nunca conoce cuál está activo.
 */
export class LocalMediaStorage implements MediaStorage {
  private readonly root: string;
  private readonly publicBase: string;

  constructor(root = resolveMediaDir(), publicBase?: string) {
    this.root = root;
    this.publicBase =
      publicBase ?? process.env.MEDIA_PUBLIC_BASE_URL ?? 'http://127.0.0.1:3001/media';
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    const target = join(this.root, key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }

  async delete(key: string): Promise<void> {
    await rm(join(this.root, key), { force: true });
  }

  publicUrl(key: string): string {
    return `${this.publicBase.replace(/\/$/, '')}/${key}`;
  }
}
