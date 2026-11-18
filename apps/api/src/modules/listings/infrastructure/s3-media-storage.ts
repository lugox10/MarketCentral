import { createHash, createHmac } from 'node:crypto';

import type { MediaStorage } from '../application/ports.js';

export interface S3StorageConfig {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
}

/**
 * Adaptador S3-compatible (Cloudflare R2 y equivalentes) del puerto
 * `MediaStorage`. Firma cada petición con SigV4 usando `node:crypto`, sin SDK
 * adicional.
 *
 * Variables: `MEDIA_S3_ENDPOINT`, `MEDIA_S3_BUCKET`, `MEDIA_S3_REGION`,
 * `MEDIA_S3_ACCESS_KEY_ID`, `MEDIA_S3_SECRET_ACCESS_KEY` y, para servir los
 * objetos, `MEDIA_S3_PUBLIC_BASE_URL`.
 *
 * Nota: el adaptador no se ha ejercitado contra un bucket real en este
 * entorno (sin credenciales); su contrato está cubierto por el adaptador local.
 */
export class S3MediaStorage implements MediaStorage {
  constructor(private readonly config: S3StorageConfig) {}

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    await this.request('PUT', key, bytes, contentType);
  }

  async delete(key: string): Promise<void> {
    await this.request('DELETE', key, Buffer.alloc(0), '');
  }

  publicUrl(key: string): string {
    const base =
      this.config.publicBaseUrl ??
      `${this.config.endpoint.replace(/\/$/, '')}/${this.config.bucket}`;
    return `${base.replace(/\/$/, '')}/${key}`;
  }

  private async request(
    method: string,
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    const url = new URL(`${this.config.endpoint.replace(/\/$/, '')}/${this.config.bucket}/${key}`);
    const bodyHash = createHash('sha256').update(body).digest('hex');
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const headers: Record<string, string> = {
      host: url.host,
      'x-amz-content-sha256': bodyHash,
      'x-amz-date': amzDate,
    };
    if (contentType) headers['content-type'] = contentType;

    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((name) => `${name}:${headers[name]}\n`)
      .join('');
    const canonicalRequest = [
      method,
      url.pathname,
      '',
      canonicalHeaders,
      signedHeaders,
      bodyHash,
    ].join('\n');

    const scope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const hmac = (key: Buffer | string, data: string): Buffer =>
      createHmac('sha256', key).update(data).digest();
    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${this.config.secretAccessKey}`, dateStamp), this.config.region), 's3'),
      'aws4_request',
    );

    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const response = await fetch(url, {
      method,
      headers: {
        ...(contentType ? { 'content-type': contentType } : {}),
        'x-amz-content-sha256': bodyHash,
        'x-amz-date': amzDate,
        authorization: `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
      ...(method === 'PUT' ? { body: new Uint8Array(body) } : {}),
    });

    if (!response.ok) {
      throw new Error(`Almacenamiento S3 respondió ${response.status} al ${method} ${key}`);
    }
  }
}
