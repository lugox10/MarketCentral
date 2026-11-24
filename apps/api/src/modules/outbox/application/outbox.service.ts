import { Inject, Injectable, Logger } from '@nestjs/common';
import { dedupeKeyFor, type OutboxEventType } from '../domain/outbox.js';
import {
  OUTBOX_REPOSITORY,
  type OutboxClient,
  type OutboxRecord,
  type OutboxRepository,
} from './ports.js';

export interface EnqueueEventInput {
  type: OutboxEventType;
  payload: Record<string, unknown>;
  /** Identificador del hecho; por defecto se usa `eventType:id`. */
  dedupeId?: string;
}

/**
 * Punto único de publicación de eventos de dominio.
 *
 * Se invoca **dentro** de la transacción que cambia el negocio, pasando el
 * cliente transaccional. Si esa transacción se revierte, el evento desaparece
 * con ella; si se confirma, el evento queda garantizado en la cola.
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(@Inject(OUTBOX_REPOSITORY) private readonly repository: OutboxRepository) {}

  async enqueue(client: OutboxClient, input: EnqueueEventInput): Promise<OutboxRecord | null> {
    const dedupeKey = input.dedupeId ? dedupeKeyFor(input.type, input.dedupeId) : undefined;

    try {
      const record = await this.repository.enqueue(client, {
        eventType: input.type,
        payload: input.payload,
        dedupeKey,
      });

      if (record) {
        this.logger.log(
          JSON.stringify({
            event: 'outbox_event_enqueued',
            eventType: record.eventType,
            outboxId: record.id,
          }),
        );
      }

      return record;
    } catch (error) {
      // Un evento no debe tumbar la operación de negocio: se registra y sigue.
      this.logger.error(
        JSON.stringify({
          event: 'outbox_enqueue_failed',
          eventType: input.type,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return null;
    }
  }
}
