import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';

import type { PublicCatalogRepository } from '../../public-catalog/application/ports.js';
import { PUBLIC_CATALOG_REPOSITORY } from '../../public-catalog/application/tokens.js';
import { ModerationError } from '../domain/moderation-error.js';
import {
  ACTION_REASON_MAX,
  REPORT_DUPLICATE_WINDOW_MS,
  REPORT_RATE_LIMIT,
  canChangeReportStatus,
  isReportReason,
  isReportStatus,
  isValidActionReason,
  isValidReportDetails,
  isValidReportEmail,
  normalizeReportDetails,
  normalizeReportEmail,
  type ReportReason,
  type ReportStatus,
} from '../domain/report.js';
import type {
  ModerationRepository,
  ModerationSummary,
  RateLimiter,
  ReportListQuery,
  ReportListResult,
  ReportRecord,
} from './ports.js';
import { IP_HASH_SECRET, MODERATION_REPOSITORY, REPORT_RATE_LIMITER } from './tokens.js';

export interface SubmitReportCommand {
  businessSlug?: string;
  listingSlug?: string;
  reason: ReportReason;
  details?: string;
  reporterEmail?: string;
  website?: string;
  reporterUserId: string | null;
  ip: string | undefined;
}

/**
 * Denuncia pública. Es deliberadamente permisiva en apariencia y estricta por
 * dentro: el honeypot responde 201 como si todo hubiera ido bien, pero no
 * guarda nada, para no dar señal a los bots de que fueron detectados.
 */
@Injectable()
export class SubmitPublicReportUseCase {
  constructor(
    @Inject(PUBLIC_CATALOG_REPOSITORY) private readonly catalog: PublicCatalogRepository,
    @Inject(MODERATION_REPOSITORY) private readonly reports: ModerationRepository,
    @Inject(REPORT_RATE_LIMITER) private readonly limiter: RateLimiter,
    @Inject(IP_HASH_SECRET) private readonly ipSecret: string,
  ) {}

  async execute(
    command: SubmitReportCommand,
  ): Promise<{ ok: true; message: string; created: boolean }> {
    if (command.website && command.website.trim().length > 0) {
      return { ok: true, message: 'Gracias, recibimos tu reporte.', created: false };
    }

    if (!isReportReason(command.reason)) {
      throw new ModerationError('INVALID_REASON', 'El motivo del reporte no es válido.');
    }

    const details = normalizeReportDetails(command.details);
    if (!isValidReportDetails(details)) {
      throw new ModerationError(
        'INVALID_DETAILS',
        'Cuéntanos un poco más (mínimo 10 caracteres) para poder revisarlo.',
      );
    }
    if (command.reason === 'OTHER' && details == null) {
      throw new ModerationError(
        'INVALID_DETAILS',
        'Cuando eliges «Otro motivo» necesitamos que expliques qué pasa.',
      );
    }

    const email = normalizeReportEmail(command.reporterEmail);
    if (!isValidReportEmail(email)) {
      throw new ModerationError('INVALID_EMAIL', 'Revisa el correo electrónico.');
    }

    const target = await this.resolveTarget(command);
    const ipHash = createHmac('sha256', this.ipSecret)
      .update(command.ip ?? 'unknown')
      .digest('hex');

    const rate = this.limiter.consume(
      `report:${ipHash}`,
      REPORT_RATE_LIMIT.limit,
      REPORT_RATE_LIMIT.windowMs,
    );
    if (!rate.allowed) {
      throw new ModerationError(
        'RATE_LIMITED',
        'Recibimos varios reportes desde tu conexión. Inténtalo más tarde.',
      );
    }

    const created = await this.reports.createUnlessDuplicate({
      businessId: target.businessId,
      listingId: target.listingId,
      reason: command.reason,
      details,
      reporterEmail: email,
      reporterUserId: command.reporterUserId,
      ipHash,
      duplicateSince: new Date(Date.now() - REPORT_DUPLICATE_WINDOW_MS),
    });

    if (!created) {
      throw new ModerationError(
        'DUPLICATE_REPORT',
        'Ya recibimos este reporte hace poco. Estamos revisándolo.',
      );
    }

    return { ok: true, message: 'Gracias, recibimos tu reporte.', created: true };
  }

  private async resolveTarget(
    command: SubmitReportCommand,
  ): Promise<{ businessId: string; listingId: string | null }> {
    const now = new Date();

    if (command.listingSlug) {
      if (!command.businessSlug) {
        throw new ModerationError('INVALID_INPUT', 'Indica el negocio junto con la publicación.');
      }
      const contact = await this.catalog.findContactTarget(
        command.businessSlug,
        command.listingSlug,
        now,
      );
      if (!contact) {
        throw new ModerationError(
          'LISTING_NOT_AVAILABLE',
          'Esta publicación ya no está disponible.',
        );
      }
      return { businessId: contact.businessId, listingId: contact.listingId };
    }

    if (!command.businessSlug) {
      throw new ModerationError('INVALID_INPUT', 'Indica el negocio o la publicación a reportar.');
    }

    const business = await this.catalog.findBusinessContactTarget(command.businessSlug, now);
    if (!business) {
      throw new ModerationError('BUSINESS_NOT_AVAILABLE', 'Este negocio ya no está disponible.');
    }
    return { businessId: business.businessId, listingId: null };
  }
}

@Injectable()
export class ListReportsUseCase {
  constructor(@Inject(MODERATION_REPOSITORY) private readonly reports: ModerationRepository) {}

  async execute(query: Partial<ReportListQuery>): Promise<ReportListResult> {
    const page = query.page && query.page > 0 ? Math.floor(query.page) : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(Math.floor(query.limit), 50) : 20;

    return this.reports.list({
      status: query.status,
      reason: query.reason,
      search: query.search?.trim() || undefined,
      page,
      limit,
    });
  }
}

@Injectable()
export class GetReportUseCase {
  constructor(@Inject(MODERATION_REPOSITORY) private readonly reports: ModerationRepository) {}

  async execute(reportId: string): Promise<ReportRecord> {
    const report = await this.reports.findById(reportId);
    if (!report) throw new ModerationError('REPORT_NOT_FOUND', 'El reporte no existe.');
    return report;
  }
}

@Injectable()
export class UpdateReportStatusUseCase {
  constructor(@Inject(MODERATION_REPOSITORY) private readonly reports: ModerationRepository) {}

  async execute(input: {
    reportId: string;
    status: ReportStatus;
    note?: string;
    actorUserId: string;
  }): Promise<ReportRecord> {
    if (!isReportStatus(input.status)) {
      throw new ModerationError('INVALID_STATUS', 'El estado no es válido.');
    }

    const report = await this.reports.findById(input.reportId);
    if (!report) throw new ModerationError('REPORT_NOT_FOUND', 'El reporte no existe.');

    if (!canChangeReportStatus(report.status, input.status)) {
      throw new ModerationError(
        'INVALID_TRANSITION',
        `No se puede pasar de «${report.status}» a «${input.status}».`,
      );
    }

    const note = normalizeReportDetails(input.note);
    const terminal = input.status === 'RESOLVED' || input.status === 'DISMISSED';

    const updated = await this.reports.setStatus({
      reportId: input.reportId,
      status: input.status,
      note,
      resolvedByAdminId: input.actorUserId,
      resolvedAt: terminal ? new Date() : null,
    });

    await this.reports.logAction({
      actorUserId: input.actorUserId,
      reportId: input.reportId,
      businessId: report.businessId,
      listingId: report.listingId,
      kind: 'REPORT_STATUS_CHANGED',
      reason: `Reporte ${report.id.slice(0, 8)} → ${input.status}${note ? `: ${note}` : ''}`,
    });

    return updated;
  }
}

@Injectable()
export class SuspendBusinessUseCase {
  constructor(@Inject(MODERATION_REPOSITORY) private readonly reports: ModerationRepository) {}

  async execute(input: {
    businessId: string;
    reason: string;
    actorUserId: string;
  }): Promise<{ ok: true; message: string }> {
    const business = await this.reports.findBusiness(input.businessId);
    if (!business) {
      throw new ModerationError('BUSINESS_NOT_FOUND', 'El negocio no existe.');
    }

    const reason = input.reason.trim();
    if (!isValidActionReason(reason.slice(0, ACTION_REASON_MAX))) {
      throw new ModerationError('INVALID_REASON_TEXT', 'Explica el motivo de la suspensión.');
    }

    if (business.status === 'SUSPENDED') {
      return { ok: true, message: 'El negocio ya estaba suspendido.' };
    }

    await this.reports.setBusinessStatus(business.id, 'SUSPENDED');
    await this.reports.logAction({
      actorUserId: input.actorUserId,
      reportId: null,
      businessId: business.id,
      listingId: null,
      kind: 'BUSINESS_SUSPENDED',
      reason: reason.slice(0, ACTION_REASON_MAX),
    });

    return { ok: true, message: `Suspendimos «${business.name}».` };
  }
}

@Injectable()
export class ArchiveListingUseCase {
  constructor(@Inject(MODERATION_REPOSITORY) private readonly reports: ModerationRepository) {}

  async execute(input: {
    listingId: string;
    reason?: string;
    reportId?: string;
    actorUserId: string;
  }): Promise<{ ok: true; message: string }> {
    const listing = await this.reports.findListing(input.listingId);
    if (!listing) {
      throw new ModerationError('LISTING_NOT_FOUND', 'La publicación no existe.');
    }

    if (listing.status === 'ARCHIVED') {
      return { ok: true, message: 'La publicación ya estaba archivada.' };
    }

    const reason = (input.reason?.trim() || 'Archivada por moderación').slice(0, ACTION_REASON_MAX);
    if (!isValidActionReason(reason)) {
      throw new ModerationError('INVALID_REASON_TEXT', 'Explica el motivo del archivado.');
    }

    await this.reports.archiveListing(listing.id);
    await this.reports.logAction({
      actorUserId: input.actorUserId,
      reportId: input.reportId ?? null,
      businessId: listing.businessId,
      listingId: listing.id,
      kind: 'LISTING_ARCHIVED',
      reason,
    });

    return { ok: true, message: `Archivamos «${listing.title}».` };
  }
}

@Injectable()
export class GetModerationSummaryUseCase {
  constructor(@Inject(MODERATION_REPOSITORY) private readonly reports: ModerationRepository) {}

  async execute(): Promise<ModerationSummary> {
    return this.reports.summary();
  }
}
