/* eslint-disable @typescript-eslint/consistent-type-imports -- los DTO se usan como metatipo de validación (design:paramtypes), no solo como tipo */
import { Body, Controller, HttpCode, Ip, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthenticatedActor } from '../../auth/infrastructure/session.guard.js';
import { CreatePublicReportDto } from '../application/dto.js';
import { SubmitPublicReportUseCase } from '../application/moderation.use-cases.js';
import { CreateReportResponseDto } from '../application/responses.js';
import { ModerationExceptionFilter } from '../infrastructure/moderation-exception.filter.js';
import { OptionalSessionGuard } from '../infrastructure/optional-session.guard.js';

/** Sesión opcional: si hay usuario autenticado se guarda como denunciante. */
function optionalActor(request: Request): AuthenticatedActor | null {
  return (request as Request & { actor?: AuthenticatedActor }).actor ?? null;
}

@ApiTags('public')
@Controller('public')
@UseGuards(OptionalSessionGuard)
@UseFilters(ModerationExceptionFilter)
export class PublicReportController {
  constructor(private readonly submitReport: SubmitPublicReportUseCase) {}

  @Post('reports')
  @HttpCode(201)
  @ApiBody({ type: CreatePublicReportDto })
  @ApiCreatedResponse({ type: CreateReportResponseDto })
  async create(
    @Body() body: CreatePublicReportDto,
    @Ip() ip: string,
    @Req() request: Request,
  ): Promise<CreateReportResponseDto> {
    const actor = optionalActor(request);

    const result = await this.submitReport.execute({
      businessSlug: body.businessSlug,
      listingSlug: body.listingSlug,
      reason: body.reason,
      details: body.details,
      reporterEmail: body.reporterEmail,
      website: body.website,
      reporterUserId: actor?.userId ?? null,
      ip,
    });

    return { ok: true, message: result.message };
  }
}
