import { Body, Controller, Get, Inject, Patch, Post, UseFilters, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
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
import { CreateBusinessUseCase } from '../application/create-business.use-case.js';
import { GetMyBusinessUseCase, UpdateBusinessUseCase } from '../application/business.use-cases.js';
import { CreateBusinessDto, UpdateBusinessDto } from '../application/dto.js';
import { MyBusinessResponseDto } from '../application/responses.js';
import type { BusinessContext } from '../application/ports.js';
import { BusinessExceptionFilter } from './business-exception.filter.js';

function present(context: BusinessContext): MyBusinessResponseDto {
  return {
    business: context.business,
    membershipRole: context.membershipRole,
    subscription: context.subscription,
  };
}

/**
 * Endpoints del negocio del actor (E2).
 *
 * El tenant **nunca** llega por parámetro: se resuelve con `actor.userId` desde
 * la sesión. `ValidationPipe` con `forbidNonWhitelisted` rechaza cualquier
 * `businessId` que un cliente intente colar en el cuerpo.
 */
@ApiTags('businesses')
@ApiCookieAuth('mc_session')
@Controller('businesses')
@UseGuards(SessionGuard)
@UseFilters(BusinessExceptionFilter)
export class BusinessController {
  constructor(
    @Inject(CreateBusinessUseCase) private readonly createBusiness: CreateBusinessUseCase,
    @Inject(GetMyBusinessUseCase) private readonly getMyBusiness: GetMyBusinessUseCase,
    @Inject(UpdateBusinessUseCase) private readonly updateBusiness: UpdateBusinessUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crea el negocio del usuario autenticado (plan Free, TRIALING)' })
  @ApiBody({ type: CreateBusinessDto })
  @ApiCreatedResponse({ type: MyBusinessResponseDto })
  @ApiConflictResponse({ description: 'El usuario ya tiene un negocio' })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  async create(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateBusinessDto,
  ): Promise<MyBusinessResponseDto> {
    const context = await this.createBusiness.execute({
      userId: actor.userId,
      verticalId: dto.verticalId,
      name: dto.name,
      city: dto.city,
      addressLine: dto.addressLine,
      whatsapp: dto.whatsapp,
    });
    return present(context);
  }

  @Get('me')
  @ApiOperation({ summary: 'Negocio, membresía y suscripción del usuario autenticado' })
  @ApiOkResponse({ type: MyBusinessResponseDto })
  @ApiNotFoundResponse({ description: 'El usuario todavía no tiene negocio' })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  async me(@CurrentActor() actor: AuthenticatedActor): Promise<MyBusinessResponseDto> {
    return present(await this.getMyBusiness.execute(actor.userId));
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualiza el perfil del negocio propio' })
  @ApiBody({ type: UpdateBusinessDto })
  @ApiOkResponse({ type: MyBusinessResponseDto })
  @ApiNotFoundResponse({ description: 'El usuario todavía no tiene negocio' })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  async update(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: UpdateBusinessDto,
  ): Promise<MyBusinessResponseDto> {
    const context = await this.updateBusiness.execute(actor.userId, dto);
    return present(context);
  }
}
