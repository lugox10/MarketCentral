import { Injectable } from '@nestjs/common';

import type { RateLimiter } from '../application/ports.js';

/**
 * Límite en memoria por clave (IP anonimizada). Suficiente para una sola
 * instancia del API; con varias réplicas debe moverse a Redis.
 */
@Injectable()
export class InMemoryReportRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, number[]>();

  consume(
    key: string,
    limit: number,
    windowMs: number,
  ): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    const hits = (this.buckets.get(key) ?? []).filter((time) => now - time < windowMs);

    if (hits.length >= limit) {
      this.buckets.set(key, hits);
      const oldest = hits[0] ?? now;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
      };
    }

    hits.push(now);
    this.buckets.set(key, hits);

    if (this.buckets.size > 5_000) {
      for (const [entryKey, entry] of this.buckets) {
        if (entry.every((time) => now - time >= windowMs)) this.buckets.delete(entryKey);
      }
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }
}
