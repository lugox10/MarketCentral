import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  EnqueueInput,
  OutboxClient,
  OutboxRecord,
  OutboxRepository,
} from '../application/ports.js';

type Row = {
  id: string;
  eventType: string;
  payload: unknown;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  attempts: number;
  dedupeKey: string | null;
  availableAt: Date;
  createdAt: Date;
  processedAt: Date | null;
};

@Injectable()
export class PrismaOutboxRepository implements OutboxRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async enqueue(client: OutboxClient, input: EnqueueInput): Promise<OutboxRecord | null> {
    try {
      const row = await client.outboxEvent.create({
        data: {
          eventType: input.eventType,
          payload: input.payload as never,
          dedupeKey: input.dedupeKey ?? null,
          availableAt: input.availableAt ?? new Date(),
        },
      });
      return toRecord(row as Row);
    } catch (error) {
      // Violación del único de deduplicación: el hecho ya está registrado.
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }

  async listPending(now: Date, limit: number): Promise<OutboxRecord[]> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { status: 'PENDING', availableAt: { lte: now } },
      orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    });
    return rows.map((row: Row) => toRecord(row));
  }

  async markProcessed(id: string, processedAt: Date): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: 'PROCESSED', processedAt, lastError: null },
    });
  }

  async markRetry(id: string, attempts: number, error: string, availableAt: Date): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: 'PENDING', attempts, lastError: error, availableAt },
    });
  }

  async markFailed(id: string, attempts: number, error: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: 'FAILED', attempts, lastError: error },
    });
  }

  async countByStatus(): Promise<Record<'PENDING' | 'PROCESSED' | 'FAILED', number>> {
    const grouped = await this.prisma.outboxEvent.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const counts: Record<'PENDING' | 'PROCESSED' | 'FAILED', number> = {
      PENDING: 0,
      PROCESSED: 0,
      FAILED: 0,
    };
    for (const row of grouped) {
      counts[row.status] = row._count._all;
    }
    return counts;
  }
}

function toRecord(row: Row): OutboxRecord {
  return {
    id: row.id,
    eventType: row.eventType,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    dedupeKey: row.dedupeKey,
    availableAt: row.availableAt,
    createdAt: row.createdAt,
    processedAt: row.processedAt,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}
