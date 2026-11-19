import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';

import { MAIL_SENDER } from '../../auth/application/tokens.js';
import type { MailSender } from '../../auth/application/ports.js';
import { BUSINESS_REPOSITORY } from '../../businesses/application/tokens.js';
import type { BusinessRepository } from '../../businesses/application/ports.js';
import { PUBLIC_CATALOG_REPOSITORY } from '../../public-catalog/application/tokens.js';
import type { PublicCatalogRepository } from '../../public-catalog/application/ports.js';
import {
  computeLeadsExpiresAt,
  canSetLeadStatus,
  isValidLeadEmail,
  isValidLeadMessage,
  isValidLeadName,
  isLeadStatus,
  normalizeLeadEmail,
  normalizeLeadName,
  normalizeLeadPhone,
  sanitizeLeadMessage,
  LEAD_DUPLICATE_WINDOW_MS,
  type LeadStatusValue,
} from '../domain/lead.js';
import { LeadError } from '../domain/lead-error.js';
import {
  FORM_TOKEN_TTL_MS,
  MIN_FILL_MS,
  verifyFormToken,
  createFormToken,
} from '../domain/form-token.js';
import { FORM_TOKEN_SECRET, IP_HASH_SECRET, LEAD_RATE_LIMITER, LEAD_REPOSITORY } from './tokens.js';
import type { LeadListQuery, LeadRecord, LeadRepository, RateLimiter } from './ports.js';

/** Límites anti-abuso del formulario público. */
export const LEAD_RATE_LIMIT_PER_HOUR = 30;
export const LEAD_RATE_WINDOW_MS = 60 * 60 * 1000;
const MESSAGE_PREVIEW_LENGTH = 280;

export interface SubmitPublicLeadCommand {
  businessSlug: string;
  listingSlug?: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  message: string;
  consent: boolean;
  honeypot?: string;
  formToken: string;
  ip?: string;
}

export interface SubmitPublicLeadResult {
  ok: true;
  message: string;
}

const GENERIC_ACCEPTED = 'Recibimos tu mensaje. El negocio te contactará directamente.';

@Injectable()
export class IssueFormTokenUseCase {
  constructor(@Inject(FORM_TOKEN_SECRET) private readonly secret: string) {}

  execute(): { token: string; minSeconds: number; ttlSeconds: number } {
    return {
      token: createFormToken(new Date(), this.secret),
      minSeconds: Math.ceil(MIN_FILL_MS / 1000),
      ttlSeconds: Math.ceil(FORM_TOKEN_TTL_MS / 1000),
    };
  }
}

@Injectable()
export class SubmitPublicLeadUseCase {
  private readonly logger = new Logger(SubmitPublicLeadUseCase.name);

  constructor(
    @Inject(PUBLIC_CATALOG_REPOSITORY) private readonly catalog: PublicCatalogRepository,
    @Inject(LEAD_REPOSITORY) private readonly leads: LeadRepository,
    @Inject(LEAD_RATE_LIMITER) private readonly limiter: RateLimiter,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    @Inject(IP_HASH_SECRET) private readonly ipSecret: string,
    @Inject(FORM_TOKEN_SECRET) private readonly tokenSecret: string,
  ) {}

  async execute(command: SubmitPublicLeadCommand): Promise<SubmitPublicLeadResult> {
    const now = new Date();

    const token = verifyFormToken(command.formToken, this.tokenSecret, now);
    if (!token.ok) {
      if (token.reason === 'EXPIRED') {
        throw new LeadError('FORM_TOKEN_EXPIRED', 'El formulario expiró. Recarga la página.');
      }
      if (token.reason === 'TOO_FAST') {
        throw new LeadError('FORM_TOKEN_TOO_FAST', 'Espera un momento antes de enviar el mensaje.');
      }
      throw new LeadError('FORM_TOKEN_INVALID', 'El formulario no es válido. Recarga la página.');
    }

    // Honeypot: respondemos como si se hubiera aceptado, pero no persistimos nada.
    if (command.honeypot && command.honeypot.trim().length > 0) {
      return { ok: true, message: GENERIC_ACCEPTED };
    }

    if (command.consent !== true) {
      throw new LeadError('CONSENT_REQUIRED', 'Debes autorizar el contacto con el negocio.');
    }

    const buyerName = normalizeLeadName(command.buyerName);
    if (!isValidLeadName(buyerName)) {
      throw new LeadError('INVALID_NAME', 'El nombre debe tener entre 2 y 100 caracteres.');
    }

    const buyerEmail = normalizeLeadEmail(command.buyerEmail);
    if (!isValidLeadEmail(buyerEmail)) {
      throw new LeadError('INVALID_EMAIL', 'El correo no tiene un formato válido.');
    }

    const buyerPhone = normalizeLeadPhone(command.buyerPhone);
    if (!buyerPhone) {
      throw new LeadError('INVALID_PHONE', 'El teléfono no tiene un formato válido.');
    }

    const message = sanitizeLeadMessage(command.message);
    if (!isValidLeadMessage(message)) {
      throw new LeadError('INVALID_MESSAGE', 'El mensaje debe tener entre 10 y 2000 caracteres.');
    }

    const target = command.listingSlug
      ? await this.findListingTarget(command.businessSlug, command.listingSlug, now)
      : await this.findBusinessTarget(command.businessSlug, now);

    if (!target) {
      throw new LeadError(
        'LISTING_NOT_AVAILABLE',
        'La publicación ya no está disponible para recibir mensajes.',
      );
    }

    const ipHash = this.hashIp(command.ip);

    const ipLimit = await this.limiter.consume(
      `lead:ip:${ipHash}`,
      LEAD_RATE_LIMIT_PER_HOUR,
      LEAD_RATE_WINDOW_MS,
    );
    if (!ipLimit.allowed) {
      throw new LeadError('RATE_LIMITED', 'Recibimos demasiados mensajes. Inténtalo más tarde.');
    }

    const businessLimit = await this.limiter.consume(
      `lead:business:${target.businessId}`,
      LEAD_RATE_LIMIT_PER_HOUR,
      LEAD_RATE_WINDOW_MS,
    );
    if (!businessLimit.allowed) {
      throw new LeadError('RATE_LIMITED', 'Recibimos demasiados mensajes. Inténtalo más tarde.');
    }

    const duplicateSince = new Date(now.getTime() - LEAD_DUPLICATE_WINDOW_MS);
    const { created, lead } = await this.leads.createUnlessDuplicate(
      {
        businessId: target.businessId,
        listingId: target.listingId,
        buyerName,
        buyerEmail,
        buyerPhone,
        message,
        source: target.source,
        consentAt: now,
        ipHash,
        createdAt: now,
        expiresAt: computeLeadsExpiresAt(now),
      },
      duplicateSince,
    );

    if (!created || !lead) {
      throw new LeadError(
        'DUPLICATE_LEAD',
        'Ya enviaste un mensaje para esta publicación hace menos de 24 horas.',
      );
    }

    await this.notifyBusiness(target.businessId, lead);

    return { ok: true, message: GENERIC_ACCEPTED };
  }

  private async findListingTarget(
    businessSlug: string,
    listingSlug: string,
    now: Date,
  ): Promise<{
    businessId: string;
    businessName: string;
    listingId: string;
    source: 'LISTING';
  } | null> {
    const contact = await this.catalog.findContactTarget(businessSlug, listingSlug, now);
    if (!contact) return null;

    return {
      businessId: contact.businessId,
      businessName: contact.businessName,
      listingId: contact.listingId,
      source: 'LISTING',
    };
  }

  private async findBusinessTarget(
    businessSlug: string,
    now: Date,
  ): Promise<{
    businessId: string;
    businessName: string;
    listingId: null;
    source: 'BUSINESS_PROFILE';
  } | null> {
    const business = await this.catalog.findBusinessContactTarget(businessSlug, now);
    if (!business) return null;

    return {
      businessId: business.businessId,
      businessName: business.businessName,
      listingId: null,
      source: 'BUSINESS_PROFILE',
    };
  }

  /**
   * Aviso best-effort: un fallo de correo nunca revierte el lead ni provoca un segundo
   * guardado. Se registra solo el id del lead y el negocio, nunca datos personales.
   */
  private async notifyBusiness(businessId: string, lead: LeadRecord): Promise<void> {
    try {
      const recipient = await this.leads.findRecipient(businessId);
      if (!recipient) return;

      await this.mail.sendNewLeadEmail({
        to: recipient.email,
        name: recipient.name,
        businessName: recipient.businessName,
        buyerName: lead.buyerName,
        listingTitle: lead.listingTitle,
        messagePreview: lead.message.slice(0, MESSAGE_PREVIEW_LENGTH),
        leadId: lead.id,
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar el aviso del lead ${lead.id} del negocio ${businessId}: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    }
  }

  private hashIp(ip: string | undefined): string {
    return createHmac('sha256', this.ipSecret)
      .update(ip ?? 'unknown')
      .digest('hex');
  }
}

@Injectable()
export class ListLeadsUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository,
    @Inject(LEAD_REPOSITORY) private readonly leads: LeadRepository,
  ) {}

  async execute(
    userId: string,
    query: Omit<LeadListQuery, 'businessId'>,
  ): Promise<Awaited<ReturnType<LeadRepository['listByBusiness']>>> {
    const businessId = await this.requireBusinessId(userId);
    return this.leads.listByBusiness({ ...query, businessId });
  }

  private async requireBusinessId(userId: string): Promise<string> {
    const context = await this.businesses.findByUserId(userId);
    if (!context) throw new LeadError('BUSINESS_NOT_FOUND', 'No tienes un negocio activo.');
    return context.business.id;
  }
}

@Injectable()
export class GetLeadUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository,
    @Inject(LEAD_REPOSITORY) private readonly leads: LeadRepository,
  ) {}

  async execute(userId: string, leadId: string): Promise<LeadRecord> {
    const context = await this.businesses.findByUserId(userId);
    if (!context) throw new LeadError('BUSINESS_NOT_FOUND', 'No tienes un negocio activo.');

    const lead = await this.leads.markRead(leadId, context.business.id);
    if (!lead) throw new LeadError('LEAD_NOT_FOUND', 'El mensaje no existe.');
    return lead;
  }
}

@Injectable()
export class UpdateLeadStatusUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository,
    @Inject(LEAD_REPOSITORY) private readonly leads: LeadRepository,
  ) {}

  async execute(userId: string, leadId: string, status: LeadStatusValue): Promise<LeadRecord> {
    if (!isLeadStatus(status)) throw new LeadError('INVALID_STATUS', 'Estado no válido.');

    const context = await this.businesses.findByUserId(userId);
    if (!context) throw new LeadError('BUSINESS_NOT_FOUND', 'No tienes un negocio activo.');

    const current = await this.leads.findByIdForBusiness(leadId, context.business.id);
    if (!current) throw new LeadError('LEAD_NOT_FOUND', 'El mensaje no existe.');

    if (!canSetLeadStatus(current.status, status)) {
      throw new LeadError('INVALID_STATUS', 'No puedes volver un mensaje al estado nuevo.');
    }

    const updated = await this.leads.setStatus(leadId, context.business.id, status);
    if (!updated) throw new LeadError('LEAD_NOT_FOUND', 'El mensaje no existe.');
    return updated;
  }
}

@Injectable()
export class GetLeadsSummaryUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository,
    @Inject(LEAD_REPOSITORY) private readonly leads: LeadRepository,
  ) {}

  async execute(userId: string): Promise<{ unreadCount: number; total: number }> {
    const context = await this.businesses.findByUserId(userId);
    if (!context) throw new LeadError('BUSINESS_NOT_FOUND', 'No tienes un negocio activo.');

    const result = await this.leads.listByBusiness({
      businessId: context.business.id,
      page: 1,
      limit: 1,
    });
    return { unreadCount: result.unreadCount, total: result.total };
  }
}
