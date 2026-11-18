/* eslint-disable @typescript-eslint/consistent-type-imports --
   El DTO de query se referencia en los metadatos de Nest (design:paramtypes),
   que TypeScript emite como valor; import type dejaria el metatipo sin resolver. */
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
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
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  CurrentActor,
  type AuthenticatedActor,
  SessionGuard,
} from '../../auth/infrastructure/session.guard.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import {
  ActivateSubscriptionUseCase,
  AdjustTrialUseCase,
  GetSubscriptionHistoryUseCase,
  ListAdminSubscriptionsUseCase,
  ListPlansUseCase,
  UpdatePlanUseCase,
} from '../application/subscription.use-cases.js';
import {
  ActivateSubscriptionDto,
  AdjustTrialDto,
  ListAdminSubscriptionsQueryDto,
  UpdatePlanDto,
} from '../application/dto.js';
import {
  ActivationDetailDto,
  ActivateSubscriptionResponseDto,
  AdminSubscriptionPageDto,
  PlanResponseDto,
  toActivationDetail,
  toAdminRow,
  toMySubscription,
  toPlanResponse,
} from '../application/responses.js';
import { SubscriptionExceptionFilter } from './subscription-exception.filter.js';

/**
 * Administración de suscripciones (E4).
 *
 * Todas las rutas exigen `SUPER_ADMIN`. El administrador que firma la
 * activación sale del `ActorContext`, nunca del cuerpo.
 */
@ApiTags('admin-subscriptions')
@ApiCookieAuth('mc_session')
@Controller('admin/subscriptions')
@UseGuards(SessionGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@UseFilters(SubscriptionExceptionFilter)
export class AdminSubscriptionController {
  constructor(
    @Inject(ListAdminSubscriptionsUseCase)
    private readonly listSubscriptions: ListAdminSubscriptionsUseCase,
    @Inject(GetSubscriptionHistoryUseCase)
    private readonly getHistory: GetSubscriptionHistoryUseCase,
    @Inject(ActivateSubscriptionUseCase)
    private readonly activateSubscription: ActivateSubscriptionUseCase,
    @Inject(AdjustTrialUseCase) private readonly adjustTrialUse: AdjustTrialUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listado paginado de suscripciones con filtros' })
  @ApiOkResponse({ type: AdminSubscriptionPageDto })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  @ApiForbiddenResponse({ description: 'El usuario no es SUPER_ADMIN' })
  async list(@Query() query: ListAdminSubscriptionsQueryDto): Promise<AdminSubscriptionPageDto> {
    const page = await this.listSubscriptions.execute({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
      planCode: query.plan,
      search: query.q,
    });

    const now = new Date();
    return {
      items: page.items.map((item) => toAdminRow(item, now)),
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      total: page.total,
      totalPages: Math.max(1, Math.ceil(page.total / (query.limit ?? 20))),
    };
  }

  @Get(':businessId/history')
  @ApiOperation({ summary: 'Historial inmutable de activaciones de un negocio' })
  @ApiOkResponse({ type: ActivationDetailDto, isArray: true })
  @ApiNotFoundResponse({ description: 'El negocio no existe' })
  async history(
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ): Promise<ActivationDetailDto[]> {
    const activations = await this.getHistory.execute(businessId);
    return activations.map(toActivationDetail);
  }

  @Post(':businessId/activate')
  @ApiOperation({ summary: 'Activa o renueva manualmente un plan pagado (Base o Pro)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Clave estable por intento; un reintento devuelve el resultado original',
  })
  @ApiBody({ type: ActivateSubscriptionDto })
  @ApiCreatedResponse({ type: ActivateSubscriptionResponseDto })
  @ApiConflictResponse({ description: 'La Idempotency-Key ya se usó con otro contenido' })
  @ApiNotFoundResponse({ description: 'El negocio o el plan no existen' })
  async activate(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: ActivateSubscriptionDto,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ActivateSubscriptionResponseDto> {
    const result = await this.activateSubscription.execute({
      businessId,
      adminId: actor.userId,
      planId: body.planId,
      note: body.note,
      idempotencyKey: idempotencyKey ?? null,
    });

    const now = new Date();
    return {
      subscription: toMySubscription(result.subscription, now),
      activation: toActivationDetail(result.activation),
      replayed: result.replayed,
    };
  }

  @Patch(':businessId/trial')
  @ApiOperation({ summary: 'Ajusta o revoca la prueba de un negocio (0, 5, 15 o 20 días)' })
  @ApiBody({ type: AdjustTrialDto })
  @ApiCreatedResponse({ type: ActivateSubscriptionResponseDto })
  @ApiNotFoundResponse({ description: 'El negocio no existe o no tiene suscripción' })
  async adjustTrial(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: AdjustTrialDto,
    @CurrentActor() actor: AuthenticatedActor,
  ): Promise<ActivateSubscriptionResponseDto> {
    const result = await this.adjustTrialUse.execute({
      businessId,
      adminId: actor.userId,
      days: body.days,
      note: body.note,
    });

    const now = new Date();
    return {
      subscription: toMySubscription(result.subscription, now),
      activation: toActivationDetail(result.activation),
      replayed: result.replayed,
    };
  }
}

/**
 * Administración del catálogo de planes: precios, cupos y disponibilidad.
 * Es la palanca con la que se cierran las altas desactivando Free.
 */
@ApiTags('admin-plans')
@ApiCookieAuth('mc_session')
@Controller('admin/plans')
@UseGuards(SessionGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@UseFilters(SubscriptionExceptionFilter)
export class AdminPlansController {
  constructor(
    @Inject(ListPlansUseCase) private readonly listPlans: ListPlansUseCase,
    @Inject(UpdatePlanUseCase) private readonly updatePlan: UpdatePlanUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Planes con sus límites, incluidos los inactivos' })
  @ApiOkResponse({ type: PlanResponseDto, isArray: true })
  async list(): Promise<PlanResponseDto[]> {
    const plans = await this.listPlans.execute();
    return plans.map(toPlanResponse);
  }

  @Patch(':planId')
  @ApiOperation({ summary: 'Actualiza precio, cupos, prueba o disponibilidad de un plan' })
  @ApiBody({ type: UpdatePlanDto })
  @ApiOkResponse({ type: PlanResponseDto })
  @ApiNotFoundResponse({ description: 'El plan no existe' })
  async update(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() body: UpdatePlanDto,
  ): Promise<PlanResponseDto> {
    const plan = await this.updatePlan.execute(planId, {
      priceCop: body.priceCop,
      maxListings: body.maxListings,
      maxCategories: body.maxCategories,
      featuredSlots: body.featuredSlots,
      trialMonths: body.trialMonths,
      trialDays: body.trialDays,
      billingPeriodDays: body.billingPeriodDays,
      isActive: body.isActive,
    });
    return toPlanResponse(plan);
  }
}
