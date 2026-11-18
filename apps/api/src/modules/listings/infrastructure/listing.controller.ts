/* eslint-disable @typescript-eslint/consistent-type-imports -- los DTO se usan como metatipo de validación (design:paramtypes), no solo como tipo */
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
  ChangeListingStatusUseCase,
  CreateListingUseCase,
  ToggleFeaturedUseCase,
  UpdateListingUseCase,
} from '../application/use-cases.js';
import { GetMyListingUseCase, ListMyListingsUseCase } from '../application/queries.use-cases.js';
import {
  CreateListingDto,
  FeatureListingDto,
  ListListingsQueryDto,
  UpdateListingDto,
} from '../application/dto.js';
import {
  ListingListResponseDto,
  ListingResponseDto,
  toListingResponse,
} from '../application/responses.js';
import { MEDIA_STORAGE } from '../application/tokens.js';
import type { MediaStorage } from '../application/ports.js';
import { ListingExceptionFilter } from './listing-exception.filter.js';

/**
 * Inventario del negocio (E5, Fases 3–4).
 *
 * El `businessId` nunca viaja en la petición: se resuelve desde la sesión.
 * Publicar exige al menos una imagen; los cupos salen del plan vigente.
 */
@ApiTags('listings')
@ApiCookieAuth('mc_session')
@Controller('businesses/me/listings')
@UseGuards(SessionGuard)
@UseFilters(ListingExceptionFilter)
export class ListingController {
  constructor(
    @Inject(CreateListingUseCase) private readonly createListing: CreateListingUseCase,
    @Inject(UpdateListingUseCase) private readonly updateListing: UpdateListingUseCase,
    @Inject(ChangeListingStatusUseCase)
    private readonly changeStatus: ChangeListingStatusUseCase,
    @Inject(ToggleFeaturedUseCase) private readonly toggleFeatured: ToggleFeaturedUseCase,
    @Inject(ListMyListingsUseCase) private readonly listListings: ListMyListingsUseCase,
    @Inject(GetMyListingUseCase) private readonly getListing: GetMyListingUseCase,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  private present(listing: Parameters<typeof toListingResponse>[0]): ListingResponseDto {
    return toListingResponse(listing, (key) => this.storage.publicUrl(key));
  }

  @Get()
  @ApiOperation({ summary: 'Lista el inventario del negocio con sus cupos' })
  @ApiOkResponse({ type: ListingListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  async list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListListingsQueryDto,
  ): Promise<ListingListResponseDto> {
    const page = await this.listListings.execute({
      userId: actor.userId,
      status: query.status,
      categoryId: query.categoryId,
      search: query.search?.trim() || undefined,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    return {
      items: page.items.map((listing) => this.present(listing)),
      total: page.total,
      page: page.page,
      limit: page.limit,
      totalPages: page.totalPages,
      limits: page.limits,
    };
  }

  @Get(':listingId')
  @ApiOperation({ summary: 'Detalle de una publicación propia' })
  @ApiParam({ name: 'listingId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: ListingResponseDto })
  @ApiForbiddenResponse({ description: 'La publicación pertenece a otro negocio' })
  @ApiNotFoundResponse({ description: 'Publicación inexistente' })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  async detail(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('listingId', new ParseUUIDPipe()) listingId: string,
  ): Promise<ListingResponseDto> {
    return this.present(await this.getListing.execute({ userId: actor.userId, listingId }));
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Crea una publicación en DRAFT' })
  @ApiBody({ type: CreateListingDto })
  @ApiCreatedResponse({ type: ListingResponseDto })
  @ApiConflictResponse({ description: 'Cupo de publicaciones agotado' })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  async create(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() body: CreateListingDto,
  ): Promise<ListingResponseDto> {
    return this.present(await this.createListing.execute({ userId: actor.userId, ...body }));
  }

  @Patch(':listingId')
  @ApiOperation({ summary: 'Edita una publicación en DRAFT o PUBLISHED' })
  @ApiParam({ name: 'listingId', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateListingDto })
  @ApiOkResponse({ type: ListingResponseDto })
  @ApiConflictResponse({ description: 'La publicación ya está vendida o archivada' })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  async update(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('listingId', new ParseUUIDPipe()) listingId: string,
    @Body() body: UpdateListingDto,
  ): Promise<ListingResponseDto> {
    return this.present(
      await this.updateListing.execute({ userId: actor.userId, listingId, ...body }),
    );
  }

  @Post(':listingId/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publica un borrador (exige al menos una imagen)' })
  @ApiParam({ name: 'listingId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: ListingResponseDto })
  @ApiConflictResponse({ description: 'Transición no permitida o cupo agotado' })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  async publish(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('listingId', new ParseUUIDPipe()) listingId: string,
  ): Promise<ListingResponseDto> {
    return this.present(
      await this.changeStatus.execute({ userId: actor.userId, listingId, to: 'PUBLISHED' }),
    );
  }

  @Post(':listingId/sell')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marca la publicación como vendida' })
  @ApiParam({ name: 'listingId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: ListingResponseDto })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  async sell(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('listingId', new ParseUUIDPipe()) listingId: string,
  ): Promise<ListingResponseDto> {
    return this.present(
      await this.changeStatus.execute({ userId: actor.userId, listingId, to: 'SOLD' }),
    );
  }

  @Post(':listingId/archive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Archiva la publicación (irreversible, libera cupo)' })
  @ApiParam({ name: 'listingId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: ListingResponseDto })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  async archive(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('listingId', new ParseUUIDPipe()) listingId: string,
  ): Promise<ListingResponseDto> {
    return this.present(
      await this.changeStatus.execute({ userId: actor.userId, listingId, to: 'ARCHIVED' }),
    );
  }

  @Patch(':listingId/feature')
  @ApiOperation({ summary: 'Destaca o quita el destacado (cupo simultáneo del plan)' })
  @ApiParam({ name: 'listingId', type: String, format: 'uuid' })
  @ApiBody({ type: FeatureListingDto })
  @ApiOkResponse({ type: ListingResponseDto })
  @ApiConflictResponse({ description: 'Sin destacados disponibles' })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  async feature(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('listingId', new ParseUUIDPipe()) listingId: string,
    @Body() body: FeatureListingDto,
  ): Promise<ListingResponseDto> {
    return this.present(
      await this.toggleFeatured.execute({
        userId: actor.userId,
        listingId,
        featured: body.featured,
      }),
    );
  }
}
