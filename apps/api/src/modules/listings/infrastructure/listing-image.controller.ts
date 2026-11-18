import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  CurrentActor,
  type AuthenticatedActor,
  SessionGuard,
} from '../../auth/infrastructure/session.guard.js';
import { MAX_IMAGE_BYTES } from '../domain/listing.js';
import { ReorderImagesDto } from '../application/dto.js';
import { ListingImageResponseDto, toListingImage } from '../application/responses.js';
import {
  AddListingImageUseCase,
  RemoveListingImageUseCase,
  ReorderListingImagesUseCase,
} from '../application/use-cases.js';
import { MEDIA_STORAGE } from '../application/tokens.js';
import type { MediaStorage } from '../application/ports.js';
import { ListingExceptionFilter } from './listing-exception.filter.js';

/** Archivo recibido por Multer; se tipa aquí para no depender de `@types/multer`. */
interface UploadedImage {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
}

@ApiTags('listings')
@ApiCookieAuth('mc_session')
@Controller('businesses/me/listings/:listingId/images')
@UseGuards(SessionGuard)
@UseFilters(ListingExceptionFilter)
export class ListingImageController {
  constructor(
    @Inject(AddListingImageUseCase) private readonly addImage: AddListingImageUseCase,
    @Inject(RemoveListingImageUseCase) private readonly removeImage: RemoveListingImageUseCase,
    @Inject(ReorderListingImagesUseCase)
    private readonly reorderImages: ReorderListingImagesUseCase,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Sube una imagen (máximo 6 por publicación, 5 MB cada una)' })
  @ApiParam({ name: 'listingId', type: String, format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: ListingImageResponseDto })
  @ApiPayloadTooLargeResponse({ description: 'La imagen supera los 5 MB' })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  async upload(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('listingId', new ParseUUIDPipe()) listingId: string,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<ListingImageResponseDto> {
    const image = await this.addImage.execute({
      userId: actor.userId,
      listingId,
      buffer: file?.buffer ?? Buffer.alloc(0),
      sizeBytes: file?.size ?? 0,
      declaredMimeType: file?.mimetype ?? '',
    });

    return toListingImage({ ...image, url: this.storage.publicUrl(image.storageKey) });
  }

  @Delete(':imageId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Elimina una imagen y reordena las restantes' })
  @ApiParam({ name: 'listingId', type: String, format: 'uuid' })
  @ApiParam({ name: 'imageId', type: String, format: 'uuid' })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  async remove(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('listingId', new ParseUUIDPipe()) listingId: string,
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
  ): Promise<void> {
    await this.removeImage.execute({ userId: actor.userId, listingId, imageId });
  }

  @Patch('order')
  @ApiOperation({ summary: 'Reordena las imágenes de la publicación' })
  @ApiParam({ name: 'listingId', type: String, format: 'uuid' })
  @ApiBody({ type: ReorderImagesDto })
  @ApiOkResponse({ type: [ListingImageResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  async reorder(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('listingId', new ParseUUIDPipe()) listingId: string,
    @Body() body: ReorderImagesDto,
  ): Promise<ListingImageResponseDto[]> {
    const images = await this.reorderImages.execute({
      userId: actor.userId,
      listingId,
      imageIds: body.imageIds,
    });

    return images.map((image) =>
      toListingImage({ ...image, url: this.storage.publicUrl(image.storageKey) }),
    );
  }
}
