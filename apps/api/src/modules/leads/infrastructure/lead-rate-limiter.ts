import { Injectable } from '@nestjs/common';

import type { RateLimiter } from '../application/ports.js';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Ventana fija en memoria. Sirve mientras el API corra en una sola instancia
 * (el caso del MVP). Con varias réplicas cada proceso llevaría su propio
 * contador; para entonces se sustituye por Redis implementando `RateLimiter`
 * sin tocar los casos de uso.
 */
@Injectable()
export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  async consume(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      this.prune(now);
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (bucket.count >= limit) {
      return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
    }

    bucket.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private prune(now: number): void {
    if (this.buckets.size < 5_000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
