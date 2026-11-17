/**
 * Reglas de visibilidad del frontend según el rol de plataforma.
 *
 * Son solo UX: el backend vuelve a autorizar cada petición. Ocultar un botón no
 * protege nada; el objetivo es no ofrecer acciones que van a responder 403.
 */

export type PlatformRole = 'SUPER_ADMIN' | 'BUSINESS_OWNER' | string;

export function isPlatformAdmin(role: PlatformRole | null | undefined): boolean {
  return role === 'SUPER_ADMIN';
}

/** `/admin/taxonomia` es exclusivo de la administración de plataforma. */
export function canAccessTaxonomy(role: PlatformRole | null | undefined): boolean {
  return isPlatformAdmin(role);
}
