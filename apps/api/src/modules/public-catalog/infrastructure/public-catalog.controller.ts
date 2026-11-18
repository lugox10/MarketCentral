/* eslint-disable @typescript-eslint/consistent-type-imports -- los DTO de query se usan como metatipo de validacion (design:paramtypes), no solo como tipo */
import { Controller, Get, Header, Param, Query, UseFilters, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import {
  PUBLIC_PAGE_SIZE,
  PublicBusinessQueryDto,
  PublicListingsQueryDto,
  PublicSitemapQueryDto,
} from '../application/dto.js';
import {
  PublicBusinessResponseDto,
  PublicListingDetailResponseDto,
  PublicListingsPageResponseDto,
  PublicSitemapEntryResponseDto,
  PublicVerticalResponseDto,
  toBusinessSummary,
  toDetail,
  toPage,
  toSitemapEntry,
  toVertical,
} from '../application/responses.js';
import {
  GetPublicBusinessUseCase,
  GetPublicListingUseCase,
  GetPublicSitemapUseCase,
  GetPublicVerticalUseCase,
  ListPublicVerticalsUseCase,
  SearchPublicListingsUseCase,
} from '../application/public-catalog.use-cases.js';
import { PublicCatalogExceptionFilter } from './public-catalog-exception.filter.js';
import { PublicRateLimitGuard } from './public-rate-limit.guard.js';

/**
 * Catálogo público agregado.
 *
 * Solo lectura: consulta las publicaciones existentes de todos los negocios
 * visibles. No posee inventario propio ni escribe nada.
 */
@ApiTags('public-catalog')
@Controller('public')
@UseGuards(PublicRateLimitGuard)
@UseFilters(PublicCatalogExceptionFilter)
export class PublicCatalogController {
  constructor(
    private readonly listVerticalsUse: ListPublicVerticalsUseCase,
    private readonly getVerticalUse: GetPublicVerticalUseCase,
    private readonly searchListingsUse: SearchPublicListingsUseCase,
    private readonly getListingUse: GetPublicListingUseCase,
    private readonly getBusinessUse: GetPublicBusinessUseCase,
    private readonly getSitemapUse: GetPublicSitemapUseCase,
  ) {}

  @Get('verticals')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=60')
  @ApiOperation({ summary: 'Verticales activas con su número de publicaciones visibles' })
  @ApiOkResponse({ type: PublicVerticalResponseDto, isArray: true })
  async listVerticals(): Promise<PublicVerticalResponseDto[]> {
    const verticals = await this.listVerticalsUse.execute();
    return verticals.map(toVertical);
  }

  @Get('verticals/:verticalSlug')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=60')
  @ApiOperation({ summary: 'Detalle de una vertical con sus categorías globales' })
  @ApiParam({ name: 'verticalSlug', type: String })
  @ApiOkResponse({ type: PublicVerticalResponseDto })
  async getVertical(
    @Param('verticalSlug') verticalSlug: string,
  ): Promise<PublicVerticalResponseDto> {
    const { vertical } = await this.getVerticalUse.execute(verticalSlug);
    return toVertical(vertical);
  }

  @Get('listings')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=30')
  @ApiOperation({ summary: 'Busca publicaciones visibles con filtros y paginación' })
  @ApiOkResponse({ type: PublicListingsPageResponseDto })
  async searchListings(
    @Query() query: PublicListingsQueryDto,
  ): Promise<PublicListingsPageResponseDto> {
    return toPage(
      await this.searchListingsUse.execute({
        verticalId: query.verticalId,
        verticalSlug: query.verticalSlug,
        city: query.city,
        categoryId: query.categoryId,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        condition: query.condition,
        searchText: query.searchText,
        featured: query.featured === undefined ? undefined : query.featured === 'true',
        page: query.page,
        limit: query.limit,
      }),
    );
  }

  @Get('listings/:businessSlug/:listingSlug')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Detalle público de una publicación' })
  @ApiParam({ name: 'businessSlug', type: String })
  @ApiParam({ name: 'listingSlug', type: String })
  @ApiOkResponse({ type: PublicListingDetailResponseDto })
  async getListing(
    @Param('businessSlug') businessSlug: string,
    @Param('listingSlug') listingSlug: string,
  ): Promise<PublicListingDetailResponseDto> {
    return toDetail(await this.getListingUse.execute(businessSlug, listingSlug));
  }

  @Get('businesses/:businessSlug')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=60')
  @ApiOperation({ summary: 'Perfil público de un negocio y sus publicaciones visibles' })
  @ApiParam({ name: 'businessSlug', type: String })
  @ApiOkResponse({ type: PublicBusinessResponseDto })
  async getBusiness(
    @Param('businessSlug') businessSlug: string,
    @Query() query: PublicBusinessQueryDto,
  ): Promise<PublicBusinessResponseDto> {
    const { business, listings } = await this.getBusinessUse.execute(
      businessSlug,
      query.page ?? 1,
      query.limit ?? PUBLIC_PAGE_SIZE,
    );
    return { ...toBusinessSummary(business), listings: toPage(listings) };
  }

  @Get('sitemap')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=300')
  @ApiOperation({ summary: 'Entradas indexables para el sitemap' })
  @ApiOkResponse({ type: PublicSitemapEntryResponseDto, isArray: true })
  async getSitemap(
    @Query() query: PublicSitemapQueryDto,
  ): Promise<PublicSitemapEntryResponseDto[]> {
    const entries = await this.getSitemapUse.execute(query.limit ?? 5000);
    return entries.map(toSitemapEntry);
  }
}
