import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

/* eslint-disable @typescript-eslint/consistent-type-imports -- los casos de uso y el DTO se usan como metatipo de inyección/validación (design:paramtypes), no solo como tipo */
import {
  CurrentActor,
  type AuthenticatedActor,
  SessionGuard,
} from '../../auth/infrastructure/session.guard.js';
import { ListLeadsQueryDto, UpdateLeadStatusDto } from '../application/dto.js';
import {
  LeadListResponseDto,
  LeadResponseDto,
  LeadSummaryResponseDto,
  toLeadResponse,
} from '../application/responses.js';
import {
  GetLeadUseCase,
  GetLeadsSummaryUseCase,
  ListLeadsUseCase,
  UpdateLeadStatusUseCase,
} from '../application/lead.use-cases.js';
import { LeadExceptionFilter } from './lead-exception.filter.js';

@ApiTags('leads')
@ApiCookieAuth('mc_session')
@Controller('businesses/me/leads')
@UseGuards(SessionGuard)
@UseFilters(LeadExceptionFilter)
export class LeadController {
  constructor(
    private readonly listLeads: ListLeadsUseCase,
    private readonly getLead: GetLeadUseCase,
    private readonly updateStatus: UpdateLeadStatusUseCase,
    private readonly summary: GetLeadsSummaryUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ type: LeadListResponseDto })
  @ApiUnauthorizedResponse()
  async list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListLeadsQueryDto,
  ): Promise<LeadListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.listLeads.execute(actor.userId, {
      status: query.status,
      search: query.search,
      page,
      limit,
    });

    return {
      items: result.items.map(toLeadResponse),
      page,
      limit,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
      unreadCount: result.unreadCount,
    };
  }

  @Get('summary')
  @ApiOkResponse({ type: LeadSummaryResponseDto })
  async getSummary(@CurrentActor() actor: AuthenticatedActor): Promise<LeadSummaryResponseDto> {
    return this.summary.execute(actor.userId);
  }

  @Get(':leadId')
  @ApiParam({ name: 'leadId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: LeadResponseDto })
  async detail(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('leadId', new ParseUUIDPipe()) leadId: string,
  ): Promise<LeadResponseDto> {
    return toLeadResponse(await this.getLead.execute(actor.userId, leadId));
  }

  @Patch(':leadId')
  @HttpCode(200)
  @ApiParam({ name: 'leadId', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateLeadStatusDto })
  @ApiOkResponse({ type: LeadResponseDto })
  async changeStatus(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('leadId', new ParseUUIDPipe()) leadId: string,
    @Body() body: UpdateLeadStatusDto,
  ): Promise<LeadResponseDto> {
    return toLeadResponse(await this.updateStatus.execute(actor.userId, leadId, body.status));
  }
}
