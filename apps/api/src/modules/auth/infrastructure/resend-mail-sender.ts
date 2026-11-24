import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { MailSender } from '../application/ports.js';

interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  reply_to?: string;
}

/**
 * Adaptador de producción sobre la API HTTP de Resend.
 *
 * Se eligió Resend sobre SMTP porque expone un endpoint JSON simple (sin
 * dependencias nuevas: `fetch` nativo) y devuelve el id del mensaje, que sirve
 * para rastrear entregas. Si `RESEND_API_KEY` no está configurada el módulo
 * registra `ConsoleMailSender` en su lugar, de modo que el desarrollo local y
 * las pruebas nunca dependen de la red.
 *
 * Regla de privacidad: los logs solo llevan el destinatario enmascarado y el
 * código HTTP del proveedor; nunca el cuerpo del correo ni tokens.
 */
@Injectable()
export class ResendMailSender implements MailSender {
  private readonly logger = new Logger('MailSender');
  private readonly apiKey: string;
  private readonly from: string;
  private readonly replyTo?: string;
  private readonly endpoint = 'https://api.resend.com/emails';

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('RESEND_API_KEY') ?? '';
    this.from = config.get<string>('MAIL_FROM') ?? 'MarketCentral <no-responder@marketcentral.app>';
    this.replyTo = config.get<string>('MAIL_REPLY_TO') || undefined;
  }

  async sendVerificationEmail(input: { to: string; name: string; token: string }): Promise<void> {
    const url = `${this.siteUrl()}/verify-email?token=${encodeURIComponent(input.token)}`;
    await this.send({
      to: input.to,
      subject: 'Confirma tu correo en MarketCentral',
      heading: `Hola ${input.name}, confirma tu correo`,
      body: 'Este enlace vence en 24 horas. Si no creaste una cuenta, ignora este mensaje.',
      action: 'Confirmar mi correo',
      url,
    });
  }

  async sendPasswordResetEmail(input: { to: string; name: string; token: string }): Promise<void> {
    const url = `${this.siteUrl()}/reset-password?token=${encodeURIComponent(input.token)}`;
    await this.send({
      to: input.to,
      subject: 'Restablece tu contraseña de MarketCentral',
      heading: `Hola ${input.name}, restablece tu contraseña`,
      body: 'Este enlace vence en 1 hora. Si no lo solicitaste, tu contraseña sigue siendo la misma.',
      action: 'Crear una contraseña nueva',
      url,
    });
  }

  async sendSubscriptionExpiryEmail(input: {
    to: string;
    name: string;
    businessName: string;
    planName: string;
    daysLeft: number;
    endsAt: Date;
  }): Promise<void> {
    await this.send({
      to: input.to,
      subject: `Tu plan ${input.planName} vence en ${input.daysLeft} día(s)`,
      heading: `Tu plan vence pronto, ${input.name}`,
      body: `El plan ${input.planName} de ${input.businessName} termina el ${input.endsAt.toISOString().slice(0, 10)}. Tus publicaciones dejarán de aparecer en el catálogo público cuando venza.`,
      action: 'Renovar mi plan',
      url: `${this.siteUrl()}/dashboard/suscripcion`,
    });
  }

  async sendNewLeadEmail(input: {
    to: string;
    name: string;
    businessName: string;
    buyerName: string;
    listingTitle: string | null;
    messagePreview: string;
    leadId: string;
  }): Promise<void> {
    await this.send({
      to: input.to,
      subject: 'Tienes un contacto nuevo en MarketCentral',
      heading: `${input.buyerName} quiere hablar contigo`,
      body: `${input.listingTitle ? `Sobre «${input.listingTitle}». ` : ''}Mensaje: ${input.messagePreview}`,
      action: 'Ver la bandeja de contactos',
      url: `${this.siteUrl()}/dashboard/leads`,
    });
  }

  private siteUrl(): string {
    return this.fromPublicUrl();
  }

  private fromPublicUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  }

  private async send(input: {
    to: string;
    subject: string;
    heading: string;
    body: string;
    action: string;
    url: string;
  }): Promise<void> {
    const payload: ResendPayload = {
      from: this.from,
      to: [input.to],
      subject: input.subject,
      html: this.html(input),
      text: `${input.heading}\n\n${input.body}\n\n${input.action}: ${input.url}\n`,
      ...(this.replyTo ? { reply_to: this.replyTo } : {}),
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      // Solo estado y destinatario enmascarado: el cuerpo puede repetir datos personales.
      this.logger.error(
        `Resend rechazó el correo para ${maskEmail(input.to)} con estado ${response.status}`,
      );
      throw new Error(`No se pudo enviar el correo (estado ${response.status})`);
    }

    this.logger.log(`Correo enviado a ${maskEmail(input.to)}`);
  }

  private html(input: {
    heading: string;
    body: string;
    action: string;
    url: string;
  }): string {
    return [
      '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1c1917">',
      `<h1 style="font-size:20px;line-height:1.3;margin:0 0 12px">${escapeHtml(input.heading)}</h1>`,
      `<p style="font-size:15px;line-height:1.6;margin:0 0 20px">${escapeHtml(input.body)}</p>`,
      `<p style="margin:0 0 24px"><a href="${escapeHtml(input.url)}" style="background:#047857;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block">${escapeHtml(input.action)}</a></p>`,
      '<p style="font-size:12px;color:#78716c;margin:0">MarketCentral no intermedia en la compra: el pago se acuerda con cada negocio.</p>',
      '</div>',
    ].join('');
  }
}

export function maskEmail(email: string): string {
  const [user = '', domain] = email.split('@');
  if (!domain) return '***';
  const visible = user.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
