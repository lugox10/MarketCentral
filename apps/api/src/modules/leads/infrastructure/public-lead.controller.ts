/* eslint-disable @typescript-eslint/consistent-type-imports -- los casos de uso y DTOs se usan como metatipo de inyección/validación (design:paramtypes), no solo como tipo */
import { Body, Controller, Get, Header, Post, Req, UseFilters } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CreatePublicLeadDto } from '../application/dto.js';
import { CreatePublicLeadResponseDto, FormTokenResponseDto } from '../application/responses.js';
import { IssueFormTokenUseCase, SubmitPublicLeadUseCase } from '../application/lead.use-cases.js';
import { LeadExceptionFilter } from './lead-exception.filter.js';

@ApiTags('public-leads')
@Controller('public')
@UseFilters(LeadExceptionFilter)
export class PublicLeadController {
  constructor(
    private readonly submitLead: SubmitPublicLeadUseCase,
    private readonly issueFormToken: IssueFormTokenUseCase,
  ) {}

  @Get('leads/form-token')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: FormTokenResponseDto })
  formToken(): FormTokenResponseDto {
    return this.issueFormToken.execute();
  }

  @Post('leads')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ type: CreatePublicLeadDto })
  @ApiCreatedResponse({ type: CreatePublicLeadResponseDto })
  async create(
    @Body() body: CreatePublicLeadDto,
    @Req() request: Request,
  ): Promise<CreatePublicLeadResponseDto> {
    return this.submitLead.execute({
      businessSlug: body.businessSlug,
      listingSlug: body.listingSlug,
      buyerName: body.buyerName,
      buyerEmail: body.buyerEmail,
      buyerPhone: body.buyerPhone,
      message: body.message,
      consent: body.consent,
      honeypot: body.website,
      formToken: body.formToken,
      ip: request.ip,
    });
  }
}
