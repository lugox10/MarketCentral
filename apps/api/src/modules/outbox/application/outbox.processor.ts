import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MAX_OUTBOX_ATTEMPTS, computeRetryDelayMs, truncateError } from '../domain/outbox.js';
import { OUTBOX_REPOSITORY, type OutboxRecord, type OutboxRepository } from './ports.js';

export interface ProcessBatchResult {
  processed: number;
  retried: number;
  failed: number;
}

/**
 * Vacía la cola de eventos pendientes.
 *
 * En el MVP el "transporte" solo escribe una línea de log estructurada: no hay
 * n8n ni webhooks salientes todavía. Cuando exista un consumidor real, el único
 * punto a cambiar es `deliver`, que debe devolver la promesa del envío para que
 * los reintentos y el estado FAILED sigan funcionando igual.
 */
@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);
  private running = false;

  constructor(@Inject(OUTBOX_REPOSITORY) private readonly repository: OutboxRepository) {}

  @Cron('*/30 * * * * *', {
    name: 'outbox-drain',
    disabled: process.env.NODE_ENV === 'test' || process.env.OUTBOX_ENABLED === 'false',
  })
  async handleCron(): Promise<void> {
    await this.processBatch();
  }

  async processBatch(limit = 25, now = new Date()): Promise<ProcessBatchResult> {
    if (this.running) return { processed: 0, retried: 0, failed: 0 };
    this.running = true;

    const result: ProcessBatchResult = { processed: 0, retried: 0, failed: 0 };

    try {
      const pending = await this.repository.listPending(now, limit);

      for (const record of pending) {
        const attempts = record.attempts + 1;

        try {
          await this.deliver(record);
          await this.repository.markProcessed(record.id, new Date());
          result.processed += 1;
        } catch (error) {
          const message = truncateError(error instanceof Error ? error.message : String(error));

          if (attempts >= MAX_OUTBOX_ATTEMPTS) {
            await this.repository.markFailed(record.id, attempts, message);
            result.failed += 1;
            this.logger.error(
              JSON.stringify({
                event: 'outbox_event_failed',
                outboxId: record.id,
                eventType: record.eventType,
                attempts,
                message,
              }),
            );
          } else {
            await this.repository.markRetry(
              record.id,
              attempts,
              message,
              new Date(now.getTime() + computeRetryDelayMs(attempts)),
            );
            result.retried += 1;
          }
        }
      }
    } finally {
      this.running = false;
    }

    return result;
  }

  private async deliver(record: OutboxRecord): Promise<void> {
    // Punto de extensión: aquí irá el POST firmado al webhook de n8n.
    this.logger.log(
      JSON.stringify({
        event: 'outbox_event_processed',
        outboxId: record.id,
        eventType: record.eventType,
        attempts: record.attempts,
      }),
    );
  }
}
