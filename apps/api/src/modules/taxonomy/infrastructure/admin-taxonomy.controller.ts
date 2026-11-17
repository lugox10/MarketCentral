/* eslint-disable @typescript-eslint/consistent-type-imports --
   Los DTO se referencian en decoradores de Nest/Swagger, que TypeScript emite
   como valores en los metadatos de la clase; `import type` romperia la
   validacion y la documentacion de la API. */
import { Body, Controller, Post, UseFilters, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { SessionGuard } from '../../auth/infrastructure/session.guard.js';
import {
  CreateAttributeUseCase,
  CreateCategoryUseCase,
  CreateVerticalUseCase,
} from '../application/create.use-cases.js';
import { CreateAttributeDto, CreateCategoryDto, CreateVerticalDto } from '../application/dto.js';
import {
  AttributeResponseDto,
  CategoryResponseDto,
  VerticalResponseDto,
} from '../application/responses.js';
import {
  toAttributeResponse,
  toCategoryResponse,
  toVerticalResponse,
} from '../application/responses.js';
import { TaxonomyExceptionFilter } from './taxonomy-exception.filter.js';

/**
 * Administración global de la taxonomía. Solo `SUPER_ADMIN`: los negocios no
 * pueden cambiar verticales, categorías ni atributos.
 */
@ApiTags('admin/taxonomy')
@ApiBearerAuth('session')
@Controller('admin/taxonomy')
@UseGuards(SessionGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@UseFilters(TaxonomyExceptionFilter)
export class AdminTaxonomyController {
  constructor(
    private readonly createVertical: CreateVerticalUseCase,
    private readonly createCategory: CreateCategoryUseCase,
    private readonly createAttribute: CreateAttributeUseCase,
  ) {}

  @Post('verticals')
  @ApiOperation({ summary: 'Crear vertical (SUPER_ADMIN)' })
  @ApiCreatedResponse({ type: VerticalResponseDto })
  @ApiUnauthorizedResponse({ description: 'Sin sesión' })
  @ApiForbiddenResponse({ description: 'Rol insuficiente' })
  @ApiConflictResponse({ description: 'Nombre o slug duplicado' })
  async vertical(@Body() dto: CreateVerticalDto): Promise<VerticalResponseDto> {
    const record = await this.createVertical.execute({ name: dto.name, slug: dto.slug });
    return toVerticalResponse(record);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Crear categoría dentro de una vertical (SUPER_ADMIN)' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Sin sesión' })
  @ApiForbiddenResponse({ description: 'Rol insuficiente' })
  @ApiConflictResponse({ description: 'Slug duplicado en la vertical' })
  async category(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const record = await this.createCategory.execute({
      verticalId: dto.verticalId,
      name: dto.name,
      slug: dto.slug,
      parentId: dto.parentId,
    });
    return toCategoryResponse(record);
  }

  @Post('attributes')
  @ApiOperation({ summary: 'Crear atributo con sus opciones ENUM (SUPER_ADMIN)' })
  @ApiCreatedResponse({ type: AttributeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Sin sesión' })
  @ApiForbiddenResponse({ description: 'Rol insuficiente' })
  @ApiConflictResponse({ description: 'Code duplicado en la categoría' })
  async attribute(@Body() dto: CreateAttributeDto): Promise<AttributeResponseDto> {
    const record = await this.createAttribute.execute({
      categoryId: dto.categoryId,
      name: dto.name,
      code: dto.code,
      type: dto.type,
      isRequired: dto.isRequired,
      isFilterable: dto.isFilterable,
      options: dto.options,
    });
    return toAttributeResponse(record);
  }
}
