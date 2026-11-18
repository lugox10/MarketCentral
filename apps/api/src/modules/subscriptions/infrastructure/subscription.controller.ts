import { Controller, Get, Inject, UseFilters, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
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
import {
  GetMySubscriptionUseCase,
  ListPlansUseCase,
} from '../application/subscription.use-cases.js';
import {
  MySubscriptionResponseDto,
  PlanResponseDto,
  toMySubscription,
  toPlanResponse,
} from '../application/responses.js';
import { SubscriptionExceptionFilter } from './subscription-exception.filter.js';

/**
 * Consultas de suscripción (E4).
 *
 * `/subscriptions/plans` es catálogo público (no expone datos de negocio).
 * `/subscriptions/me` se resuelve desde la membresía del actor: no acepta
 * `businessId` por parámetro ni por cuerpo.
 */
@ApiTags('subscriptions')
@Controller('subscriptions')
@UseFilters(SubscriptionExceptionFilter)
export class SubscriptionController {
  constructor(
    @Inject(ListPlansUseCase) private readonly listPlans: ListPlansUseCase,
    @Inject(GetMySubscriptionUseCase) private readonly getMySubscription: GetMySubscriptionUseCase,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: 'Catálogo de planes activos (Free, Base, Pro)' })
  @ApiOkResponse({ type: PlanResponseDto, isArray: true })
  async plans(): Promise<PlanResponseDto[]> {
    const plans = await this.listPlans.execute();
    return plans.map(toPlanResponse);
  }

  @Get('me')
  @ApiCookieAuth('mc_session')
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: 'Suscripción del negocio del usuario autenticado' })
  @ApiOkResponse({ type: MySubscriptionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  @ApiNotFoundResponse({
    description: 'El usuario no tiene negocio o el negocio no tiene suscripción',
  })
  async me(@CurrentActor() actor: AuthenticatedActor): Promise<MySubscriptionResponseDto> {
    const subscription = await this.getMySubscription.execute(actor.userId);
    return toMySubscription(subscription, new Date());
  }
}
