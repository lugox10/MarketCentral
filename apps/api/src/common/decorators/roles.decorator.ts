import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'mc:roles';

/** Roles de plataforma exigidos por el `RolesGuard` (p. ej. `SUPER_ADMIN`). */
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
