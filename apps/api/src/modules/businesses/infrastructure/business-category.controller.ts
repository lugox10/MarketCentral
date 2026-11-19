import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  CurrentActor,
  type AuthenticatedActor,
  SessionGuard,
} from '../../auth/infrastructure/session.guard.js';
import {
  CreateBusinessCategoryUseCase,
  ListBusinessCategoriesUseCase,
  UpdateBusinessCategoryUseCase,
} from '../application/category.use-cases.js';
import {
  CreateBusinessCategoryDto,
  UpdateBusinessCategoryDto,
} from '../application/category.dto.js';
import { BusinessCategoryListResponseDto } from '../application/category.responses.js';
import { CategoryExceptionFilter } from './category-exception.filter.js';

/**
 * Categorías propias del negocio activo (E5, Fase 2).
 *
 * El negocio se resuelve siempre desde la sesión; no existe `businessId` de
 * entrada. El cupo proviene del plan de la suscripción vigente.
 */
@ApiTags('business-categories')
@ApiCookieAuth('mc_session')
@Controller('businesses/me/categories')
@UseGuards(SessionGuard)
@UseFilters(CategoryExceptionFilter)
export class BusinessCategoryController {
  constructor(
    @Inject(ListBusinessCategoriesUseCase)
    private readonly listCategories: ListBusinessCategoriesUseCase,
    @Inject(CreateBusinessCategoryUseCase)
    private readonly createCategory: CreateBusinessCategoryUseCase,
    @Inject(UpdateBusinessCategoryUseCase)
    private readonly updateCategory: UpdateBusinessCategoryUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista las categorías propias y el cupo del plan vigente' })
  @ApiOkResponse({ type: BusinessCategoryListResponseDto })
  @ApiNotFoundResponse({ description: 'El usuario todavía no tiene negocio' })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  async list(@CurrentActor() actor: AuthenticatedActor): Promise<BusinessCategoryListResponseDto> {
    return this.present(await this.listCategories.execute(actor.userId));
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Crea una categoría propia (consume cupo del plan)' })
  @ApiBody({ type: CreateBusinessCategoryDto })
  @ApiCreatedResponse({ type: BusinessCategoryListResponseDto })
  @ApiConflictResponse({ description: 'Sin cupo, nombre duplicado o vertical inactiva' })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  async create(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() body: CreateBusinessCategoryDto,
  ): Promise<BusinessCategoryListResponseDto> {
    return this.present(await this.createCategory.execute({ userId: actor.userId, ...body }));
  }

  @Patch(':categoryId')
  @ApiOperation({ summary: 'Renombra o activa/desactiva una categoría propia' })
  @ApiParam({ name: 'categoryId', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateBusinessCategoryDto })
  @ApiOkResponse({ type: BusinessCategoryListResponseDto })
  @ApiForbiddenResponse({ description: 'La categoría pertenece a otro negocio' })
  @ApiNotFoundResponse({ description: 'Categoría inexistente' })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  async update(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @Body() body: UpdateBusinessCategoryDto,
  ): Promise<BusinessCategoryListResponseDto> {
    return this.present(
      await this.updateCategory.execute({ userId: actor.userId, categoryId, ...body }),
    );
  }

  private present(
    view: Awaited<ReturnType<ListBusinessCategoriesUseCase['execute']>>,
  ): BusinessCategoryListResponseDto {
    return {
      items: view.items.map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        parentId: item.parentId,
        isActive: item.isActive,
        createdAt: item.createdAt.toISOString(),
      })),
      used: view.used,
      limit: view.limit,
      remaining: view.remaining,
      canCreate: view.canCreate,
      planCode: view.planCode,
      upgradeHint: view.upgradeHint,
    };
  }
}
