/* eslint-disable @typescript-eslint/consistent-type-imports --
   Los DTO se referencian en decoradores de Nest/Swagger, que TypeScript emite
   como valores en los metadatos de la clase; `import type` romperia la
   validacion y la documentacion de la API. */
import { Controller, Get, Param, ParseUUIDPipe, UseFilters } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import {
  AttributeListResponseDto,
  CategoryListResponseDto,
  VerticalListResponseDto,
} from '../application/responses.js';
import {
  toAttributeResponse,
  toCategoryResponse,
  toVerticalResponse,
} from '../application/responses.js';
import {
  ListActiveVerticalsUseCase,
  ListAttributesUseCase,
  ListCategoriesUseCase,
} from '../application/queries.use-cases.js';
import { TaxonomyExceptionFilter } from './taxonomy-exception.filter.js';

@ApiTags('taxonomy')
@Controller('taxonomy')
@UseFilters(TaxonomyExceptionFilter)
export class TaxonomyController {
  constructor(
    private readonly listActiveVerticals: ListActiveVerticalsUseCase,
    private readonly listCategories: ListCategoriesUseCase,
    private readonly listAttributes: ListAttributesUseCase,
  ) {}

  @Get('verticals')
  @ApiOperation({ summary: 'Verticales activas (público)' })
  @ApiOkResponse({ type: VerticalListResponseDto })
  async verticals(): Promise<VerticalListResponseDto> {
    const items = await this.listActiveVerticals.execute();
    return { items: items.map(toVerticalResponse) };
  }

  @Get('verticals/:verticalId/categories')
  @ApiOperation({ summary: 'Categorías de una vertical (público)' })
  @ApiParam({ name: 'verticalId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: CategoryListResponseDto })
  async categories(
    @Param('verticalId', new ParseUUIDPipe()) verticalId: string,
  ): Promise<CategoryListResponseDto> {
    const items = await this.listCategories.execute(verticalId);
    return { verticalId, items: items.map(toCategoryResponse) };
  }

  @Get('categories/:categoryId/attributes')
  @ApiOperation({ summary: 'Atributos configurados de una categoría (público)' })
  @ApiParam({ name: 'categoryId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AttributeListResponseDto })
  async attributes(
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
  ): Promise<AttributeListResponseDto> {
    const items = await this.listAttributes.execute(categoryId);
    return { categoryId, items: items.map(toAttributeResponse) };
  }
}
