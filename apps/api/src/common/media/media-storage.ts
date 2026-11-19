/**
 * Puerto genérico de almacenamiento de objetos.
 *
 * Vive en `common/media` porque lo usan dos módulos (listings y businesses) y
 * el adaptador concreto (S3/R2 o disco local) es el mismo para toda la app.
 */
export interface MediaStorage {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}
