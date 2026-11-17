import { Inject, Injectable } from '@nestjs/common';

import type { BusinessStatus } from '../domain/business.js';
import { BusinessError } from '../domain/business-error.js';
import type { BusinessProfile, BusinessRepository, BusinessWithOwner } from './ports.js';
import { BUSINESS_REPOSITORY } from './tokens.js';

/**
 * Listado global para Súper Admin (E2).
 * Es una lectura de sistema: no pasa por el aislamiento por tenant, y solo
 * llega aquí un actor con rol `SUPER_ADMIN` por el `RolesGuard`.
 */
@Injectable()
export class ListBusinessesUseCase {
  constructor(@Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository) {}

  execute(): Promise<BusinessWithOwner[]> {
    return this.businesses.listAll();
  }
}

/** Cambio de estado APPROVED ⇄ SUSPENDED (E2, moderación reactiva). */
@Injectable()
export class UpdateBusinessStatusUseCase {
  constructor(@Inject(BUSINESS_REPOSITORY) private readonly businesses: BusinessRepository) {}

  async execute(businessId: string, status: BusinessStatus): Promise<BusinessProfile> {
    const existing = await this.businesses.findById(businessId);
    if (!existing) {
      throw new BusinessError('BUSINESS_NOT_FOUND', 'El negocio no existe');
    }
    return this.businesses.updateStatus(businessId, status);
  }
}
