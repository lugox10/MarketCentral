import type { Prisma, PrismaClient } from '@prisma/client';

/** Cliente válido dentro o fuera de una transacción. */
export type OutboxClient = PrismaClient | Prisma.TransactionClient;

export interface EnqueueInput {
  eventType: string;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  availableAt?: Date;
}

export interface OutboxRecord {
  id: string;
  eventType: string;
  payload: unknown;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  attempts: number;
  dedupeKey: string | null;
  availableAt: Date;
  createdAt: Date;
  processedAt: Date | null;
}

export interface OutboxRepository {
  /**
   * Inserta el evento usando el cliente recibido: si viene de una transacción,
   * el evento se confirma o se revierte junto con el cambio de negocio.
   * Devuelve null si la clave de deduplicación ya existía.
   */
  enqueue(client: OutboxClient, input: EnqueueInput): Promise<OutboxRecord | null>;

  listPending(now: Date, limit: number): Promise<OutboxRecord[]>;

  markProcessed(id: string, processedAt: Date): Promise<void>;

  markRetry(id: string, attempts: number, error: string, availableAt: Date): Promise<void>;

  markFailed(id: string, attempts: number, error: string): Promise<void>;

  countByStatus(): Promise<Record<'PENDING' | 'PROCESSED' | 'FAILED', number>>;
}

export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');
