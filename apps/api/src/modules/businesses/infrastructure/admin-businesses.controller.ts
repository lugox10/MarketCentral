import { Body, Controller, Get, Inject, Param, Patch, UseFilters, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { SessionGuard } from '../../auth/infrastructure/session.guard.js';
import {
  ListBusinessesUseCase,
  UpdateBusinessStatusUseCase,
} from '../application/admin.use-cases.js';
import { UpdateBusinessStatusDto } from '../application/dto.js';
import { AdminBusinessRowDto, BusinessResponseDto } from '../application/responses.js';
import { BusinessExceptionFilter } from './business-exception.filter.js';

/** Panel de Súper Admin: lectura global y suspensión/reactivación (E2). */
@ApiTags('admin')
@ApiCookieAuth('mc_session')
@Controller('admin/businesses')
@UseGuards(SessionGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@UseFilters(BusinessExceptionFilter)
export class AdminBusinessesController {
  constructor(
    @Inject(ListBusinessesUseCase) private readonly listBusinesses: ListBusinessesUseCase,
    @Inject(UpdateBusinessStatusUseCase)
    private readonly updateStatus: UpdateBusinessStatusUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos los negocios (solo SUPER_ADMIN)' })
  @ApiOkResponse({ type: AdminBusinessRowDto, isArray: true })
  @ApiForbiddenResponse({ description: 'El actor no es SUPER_ADMIN' })
  @ApiUnauthorizedResponse({ description: 'Sesión no iniciada' })
  list(): Promise<AdminBusinessRowDto[]> {
    return this.listBusinesses.execute();
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Suspende o reactiva un negocio (solo SUPER_ADMIN)' })
  @ApiBody({ type: UpdateBusinessStatusDto })
  @ApiOkResponse({ type: BusinessResponseDto })
  @ApiNotFoundResponse({ description: 'El negocio no existe' })
  @ApiForbiddenResponse({ description: 'El actor no es SUPER_ADMIN' })
  async status(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessStatusDto,
  ): Promise<BusinessResponseDto> {
    return this.updateStatus.execute(id, dto.status);
  }
}
