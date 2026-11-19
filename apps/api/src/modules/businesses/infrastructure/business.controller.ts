import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
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
  ApiConflictResponse,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
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
import {
  ClearBusinessImageUseCase,
  SetBusinessImageUseCase,
} from '../application/business-image.use-cases.js';
import { CreateBusinessDto, UpdateBusinessDto } from '../application/dto.js';
import { MyBusinessResponseDto } from '../application/responses.js';
import type { BusinessContext } from '../application/ports.js';
import { BusinessError } from '../domain/business-error.js';
import { BusinessExceptionFilter } from './business-exception.filter.js';

/** Archivo recibido por Multer; se tipa aquí para no depender de `@types/multer`. */
interface UploadedImage {
  buffer: Buffer;
  size: number;
}

/** Tope duro de Multer (el límite por tipo lo aplica el caso de uso). */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

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
    @Inject(SetBusinessImageUseCase) private readonly setImage: SetBusinessImageUseCase,
    @Inject(ClearBusinessImageUseCase) private readonly clearImage: ClearBusinessImageUseCase,
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

  @Post('me/logo')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sube o reemplaza el logo de la tienda (JPEG/PNG/WebP ≤ 2 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: MyBusinessResponseDto })
  @ApiPayloadTooLargeResponse({ description: 'El archivo supera 2 MB' })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  async uploadLogo(
    @CurrentActor() actor: AuthenticatedActor,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<MyBusinessResponseDto> {
    requireFile(file);
    return present(await this.setImage.execute(actor.userId, 'logo', file));
  }

  @Delete('me/logo')
  @HttpCode(200)
  @ApiOperation({ summary: 'Quita el logo de la tienda' })
  @ApiOkResponse({ type: MyBusinessResponseDto })
  async removeLogo(@CurrentActor() actor: AuthenticatedActor): Promise<MyBusinessResponseDto> {
    return present(await this.clearImage.execute(actor.userId, 'logo'));
  }

  @Post('me/cover')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sube o reemplaza la portada de la tienda (JPEG/PNG/WebP ≤ 5 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: MyBusinessResponseDto })
  @ApiPayloadTooLargeResponse({ description: 'El archivo supera 5 MB' })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  async uploadCover(
    @CurrentActor() actor: AuthenticatedActor,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<MyBusinessResponseDto> {
    requireFile(file);
    return present(await this.setImage.execute(actor.userId, 'cover', file));
  }

  @Delete('me/cover')
  @HttpCode(200)
  @ApiOperation({ summary: 'Quita la portada de la tienda' })
  @ApiOkResponse({ type: MyBusinessResponseDto })
  async removeCover(@CurrentActor() actor: AuthenticatedActor): Promise<MyBusinessResponseDto> {
    return present(await this.clearImage.execute(actor.userId, 'cover'));
  }
}

/** Un multipart sin `file` es un error de cliente, no un 500. */
function requireFile(file: UploadedImage | undefined): asserts file is UploadedImage {
  if (!file) {
    throw new BusinessError('INVALID_INPUT', 'Adjunta un archivo en el campo «file»');
  }
}
