/* eslint-disable @typescript-eslint/consistent-type-imports -- los DTO se usan como metatipo de validación (design:paramtypes), no solo como tipo */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentActor } from '../../auth/infrastructure/session.guard.js';
import { SessionGuard, type AuthenticatedActor } from '../../auth/infrastructure/session.guard.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import {
  ArchiveListingDto,
  ListReportsQueryDto,
  SuspendBusinessDto,
  UpdateReportStatusDto,
} from '../application/dto.js';
import {
  ArchiveListingUseCase,
  GetModerationSummaryUseCase,
  GetReportUseCase,
  ListReportsUseCase,
  SuspendBusinessUseCase,
  UpdateReportStatusUseCase,
} from '../application/moderation.use-cases.js';
import {
  ModerationSummaryResponseDto,
  ReportPageResponseDto,
  ReportResponseDto,
  toReportPage,
  toReportResponse,
  toSummaryResponse,
} from '../application/responses.js';
import { ModerationExceptionFilter } from '../infrastructure/moderation-exception.filter.js';

@ApiTags('admin')
@ApiCookieAuth('mc_session')
@Controller('admin')
@UseGuards(SessionGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@UseFilters(ModerationExceptionFilter)
export class AdminReportsController {
  constructor(
    private readonly listReports: ListReportsUseCase,
    private readonly getReport: GetReportUseCase,
    private readonly updateStatus: UpdateReportStatusUseCase,
    private readonly suspendBusiness: SuspendBusinessUseCase,
    private readonly archiveListing: ArchiveListingUseCase,
    private readonly summary: GetModerationSummaryUseCase,
  ) {}

  @Get('reports')
  @ApiOkResponse({ type: ReportPageResponseDto })
  async list(@Query() query: ListReportsQueryDto): Promise<ReportPageResponseDto> {
    const result = await this.listReports.execute({
      status: query.status,
      reason: query.reason,
      search: query.q,
      page: query.page,
      limit: query.limit,
    });
    return toReportPage(result);
  }

  @Get('reports/summary')
  @ApiOkResponse({ type: ModerationSummaryResponseDto })
  async getSummary(): Promise<ModerationSummaryResponseDto> {
    return toSummaryResponse(await this.summary.execute());
  }

  @Get('reports/:reportId')
  @ApiOkResponse({ type: ReportResponseDto })
  async findOne(
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
  ): Promise<ReportResponseDto> {
    return toReportResponse(await this.getReport.execute(reportId));
  }

  @Patch('reports/:reportId')
  @ApiBody({ type: UpdateReportStatusDto })
  @ApiOkResponse({ type: ReportResponseDto })
  async changeStatus(
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() body: UpdateReportStatusDto,
    @CurrentActor() actor: AuthenticatedActor,
  ): Promise<ReportResponseDto> {
    const updated = await this.updateStatus.execute({
      reportId,
      status: body.status,
      note: body.note,
      actorUserId: actor.userId,
    });
    return toReportResponse(updated);
  }

  @Post('businesses/:businessId/suspend')
  @HttpCode(200)
  @ApiBody({ type: SuspendBusinessDto })
  async suspend(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Body() body: SuspendBusinessDto,
    @CurrentActor() actor: AuthenticatedActor,
  ): Promise<{ ok: boolean; message: string }> {
    return this.suspendBusiness.execute({
      businessId,
      reason: body.reason,
      actorUserId: actor.userId,
    });
  }

  @Post('listings/:listingId/archive')
  @HttpCode(200)
  @ApiBody({ type: ArchiveListingDto })
  @ApiCreatedResponse({ description: 'Publicación archivada por moderación.' })
  async archive(
    @Param('listingId', new ParseUUIDPipe()) listingId: string,
    @Body() body: ArchiveListingDto,
    @CurrentActor() actor: AuthenticatedActor,
  ): Promise<{ ok: boolean; message: string }> {
    return this.archiveListing.execute({
      listingId,
      reason: body.reason,
      reportId: body.reportId,
      actorUserId: actor.userId,
    });
  }
}
