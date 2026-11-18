import { Injectable, Logger } from '@nestjs/common';

import type { MailSender } from '../application/ports.js';

/**
 * Adaptador de desarrollo: imprime el enlace en consola y guarda el último
 * token por tipo para poder probar el flujo sin proveedor real.
 * La interfaz `MailSender` permite sustituirlo por Resend/SES sin tocar casos de uso.
 */
@Injectable()
export class ConsoleMailSender implements MailSender {
  private readonly logger = new Logger('MailSender');
  lastVerificationToken: string | null = null;
  lastResetToken: string | null = null;

  async sendVerificationEmail(input: { to: string; name: string; token: string }): Promise<void> {
    this.lastVerificationToken = input.token;
    this.logger.log(
      `[dev] Verificación para ${input.to}: /verify-email?token=${input.token} (24 h)`,
    );
  }

  async sendPasswordResetEmail(input: { to: string; name: string; token: string }): Promise<void> {
    this.lastResetToken = input.token;
    this.logger.log(
      `[dev] Restablecimiento para ${input.to}: /reset-password?token=${input.token} (1 h)`,
    );
  }

  async sendSubscriptionExpiryEmail(input: {
    to: string;
    name: string;
    businessName: string;
    planName: string;
    daysLeft: number;
    endsAt: Date;
  }): Promise<void> {
    this.logger.log(
      `[dev] Aviso de vencimiento para ${input.to} (${input.businessName}): plan ${input.planName} vence en ${input.daysLeft} día(s), el ${input.endsAt.toISOString()}`,
    );
  }
}
