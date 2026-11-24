import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { OutboxProcessor } from './application/outbox.processor.js';
import { OutboxService } from './application/outbox.service.js';
import { OUTBOX_REPOSITORY } from './application/ports.js';
import { PrismaOutboxRepository } from './infrastructure/prisma-outbox.repository.js';

/**
 * Global a propósito: cualquier módulo que cambie estado de negocio debe poder
 * publicar su evento dentro de la misma transacción sin reimportar el módulo.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    OutboxService,
    OutboxProcessor,
    { provide: OUTBOX_REPOSITORY, useClass: PrismaOutboxRepository },
  ],
  exports: [OutboxService, OUTBOX_REPOSITORY],
})
export class OutboxModule {}
