/* eslint-disable @typescript-eslint/consistent-type-imports --
   Los DTO se referencian en decoradores de Nest/Swagger, que TypeScript emite
   como valores en los metadatos de la clase; `import type` romperia la
   validacion y la documentacion de la API. */
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
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
import {
  UpdateAttributeDto,
  UpdateCategoryDto,
  UpdateOptionDto,
  UpdateVerticalDto,
  CreateAttributeDto,
  CreateCategoryDto,
  CreateVerticalDto,
} from '../application/dto.js';
import {
  ListActiveVerticalsUseCase,
  ListAttributesUseCase,
  ListCategoriesUseCase,
} from '../application/queries.use-cases.js';
import {
  UpdateAttributeUseCase,
  UpdateCategoryUseCase,
  UpdateOptionUseCase,
  UpdateVerticalUseCase,
} from '../application/update.use-cases.js';
import {
  AttributeListResponseDto,
  AttributeOptionResponseDto,
  AttributeResponseDto,
  CategoryListResponseDto,
  CategoryResponseDto,
  VerticalListResponseDto,
  VerticalResponseDto,
} from '../application/responses.js';
import {
  toAttributeResponse,
  toCategoryResponse,
  toOption,
  toVerticalResponse,
} from '../application/responses.js';
import { TaxonomyExceptionFilter } from './taxonomy-exception.filter.js';

/**
 * Administración global de la taxonomía. Solo `SUPER_ADMIN`: los negocios no
 * pueden cambiar verticales, categorías ni atributos.
 *
 * Las lecturas de este controlador incluyen los elementos inactivos, para que
 * el panel pueda mostrarlos atenuados y reactivarlos.
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
    private readonly listVerticals: ListActiveVerticalsUseCase,
    private readonly listCategories: ListCategoriesUseCase,
    private readonly listAttributes: ListAttributesUseCase,
    private readonly updateVertical: UpdateVerticalUseCase,
    private readonly updateCategory: UpdateCategoryUseCase,
    private readonly updateAttribute: UpdateAttributeUseCase,
    private readonly updateOption: UpdateOptionUseCase,
  ) {}

  @Get('verticals')
  @ApiOperation({ summary: 'Listar verticales, incluidas las inactivas (SUPER_ADMIN)' })
  @ApiOkResponse({ type: VerticalListResponseDto })
  async verticals(): Promise<VerticalListResponseDto> {
    const records = await this.listVerticals.execute(true);
    return { items: records.map(toVerticalResponse) };
  }

  @Get('verticals/:verticalId/categories')
  @ApiOperation({ summary: 'Listar categorías de una vertical, incluidas las inactivas' })
  @ApiOkResponse({ type: CategoryListResponseDto })
  async categories(
    @Param('verticalId', new ParseUUIDPipe()) verticalId: string,
  ): Promise<CategoryListResponseDto> {
    const records = await this.listCategories.execute(verticalId, true);
    return { verticalId, items: records.map(toCategoryResponse) };
  }

  @Get('categories/:categoryId/attributes')
  @ApiOperation({ summary: 'Listar atributos de una categoría, incluidos los inactivos' })
  @ApiOkResponse({ type: AttributeListResponseDto })
  async attributes(
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
  ): Promise<AttributeListResponseDto> {
    const records = await this.listAttributes.execute(categoryId, true);
    return { categoryId, items: records.map(toAttributeResponse) };
  }

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

  @Patch('verticals/:verticalId')
  @ApiOperation({ summary: 'Editar o activar/desactivar una vertical (SUPER_ADMIN)' })
  @ApiOkResponse({ type: VerticalResponseDto })
  async patchVertical(
    @Param('verticalId', new ParseUUIDPipe()) verticalId: string,
    @Body() dto: UpdateVerticalDto,
  ): Promise<VerticalResponseDto> {
    return toVerticalResponse(
      await this.updateVertical.execute(verticalId, {
        name: dto.name,
        isActive: dto.isActive,
      }),
    );
  }

  @Patch('categories/:categoryId')
  @ApiOperation({ summary: 'Editar o activar/desactivar una categoría (SUPER_ADMIN)' })
  @ApiOkResponse({ type: CategoryResponseDto })
  async patchCategory(
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return toCategoryResponse(
      await this.updateCategory.execute(categoryId, {
        name: dto.name,
        isActive: dto.isActive,
      }),
    );
  }

  @Patch('attributes/:attributeId')
  @ApiOperation({ summary: 'Editar u activar/desactivar un atributo (SUPER_ADMIN)' })
  @ApiOkResponse({ type: AttributeResponseDto })
  async patchAttribute(
    @Param('attributeId', new ParseUUIDPipe()) attributeId: string,
    @Body() dto: UpdateAttributeDto,
  ): Promise<AttributeResponseDto> {
    return toAttributeResponse(
      await this.updateAttribute.execute(attributeId, {
        name: dto.name,
        isRequired: dto.isRequired,
        isFilterable: dto.isFilterable,
        isActive: dto.isActive,
      }),
    );
  }

  @Patch('attributes/:attributeId/options/:optionId')
  @ApiOperation({ summary: 'Editar u activar/desactivar una opción de un atributo (SUPER_ADMIN)' })
  @ApiOkResponse({ type: AttributeOptionResponseDto })
  async patchOption(
    @Param('attributeId', new ParseUUIDPipe()) attributeId: string,
    @Param('optionId', new ParseUUIDPipe()) optionId: string,
    @Body() dto: UpdateOptionDto,
  ): Promise<AttributeOptionResponseDto> {
    // El attributeId forma parte de la ruta para que el panel confirme contexto;
    // la opción se valida por su propio id.
    void attributeId;
    return toOption(await this.updateOption.execute(optionId, dto));
  }
}
