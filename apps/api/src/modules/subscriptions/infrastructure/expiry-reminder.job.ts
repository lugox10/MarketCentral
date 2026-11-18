/* eslint-disable @typescript-eslint/consistent-type-imports --
   El caso de uso se referencia en los metadatos de Nest (design:paramtypes),
   que TypeScript emite como valor; import type dejaria el metatipo sin resolver. */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { SendExpiryRemindersUseCase } from '../application/subscription.use-cases.js';

/**
 * Aviso diario de vencimiento de suscripciones.
 *
 * Se ejecuta a las 14:00 UTC (09:00 en Colombia) y solo cubre los cuatro días
 * previos al vencimiento. Es idempotente por día: el caso de uso marca
 * `expiry_notified_on`, de modo que un reinicio no duplica correos.
 */
@Injectable()
export class ExpiryReminderJob {
  private readonly logger = new Logger(ExpiryReminderJob.name);

  constructor(private readonly sendReminders: SendExpiryRemindersUseCase) {}

  @Cron('0 14 * * *', {
    name: 'subscription-expiry-reminders',
    // En pruebas no se agenda: evita temporizadores abiertos al cerrar Jest.
    disabled: process.env.NODE_ENV === 'test',
  })
  async run(): Promise<void> {
    try {
      const sent = await this.sendReminders.execute(new Date());
      if (sent > 0) {
        this.logger.log(`Avisos de vencimiento enviados: ${sent}`);
      }
    } catch (error) {
      // Un fallo del aviso no debe tumbar el proceso ni afectar la lógica de negocio.
      this.logger.error(`Fallo al enviar avisos de vencimiento: ${(error as Error).message}`);
    }
  }
}
