/**
 * Política central de visibilidad pública (E6).
 *
 * Una publicación solo es pública cuando se cumplen **todas** estas condiciones
 * a la vez, evaluadas con la misma referencia temporal:
 *
 * 1. `listing.status === PUBLISHED`
 * 2. `business.status === APPROVED`
 * 3. El negocio tiene suscripción.
 * 4. `subscription.status ∈ {TRIALING, ACTIVE}`
 * 5. `subscription.currentPeriodEnd > now`
 *
 * Esta función es la única fuente de verdad de la regla. El repositorio Prisma
 * replica la misma condición en SQL (`buildVisibilityWhere`) para que la API no
 * pueda devolver por URL directa algo que el listado oculta.
 */

export const PUBLIC_SUBSCRIPTION_STATUSES = ['TRIALING', 'ACTIVE'] as const;

export type PublicSubscriptionStatus = (typeof PUBLIC_SUBSCRIPTION_STATUSES)[number];

export interface VisibilitySnapshot {
  listingStatus: string;
  businessStatus: string;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
}

/** `true` solo si la publicación puede mostrarse e indexarse públicamente. */
export function isPubliclyVisible(snapshot: VisibilitySnapshot, now: Date): boolean {
  if (snapshot.listingStatus !== 'PUBLISHED') return false;
  if (snapshot.businessStatus !== 'APPROVED') return false;
  if (!snapshot.subscriptionStatus) return false;
  if (
    !PUBLIC_SUBSCRIPTION_STATUSES.includes(snapshot.subscriptionStatus as PublicSubscriptionStatus)
  ) {
    return false;
  }
  if (!snapshot.currentPeriodEnd) return false;
  return snapshot.currentPeriodEnd.getTime() > now.getTime();
}

/** Una sola referencia temporal por consulta pública. */
export function publicReferenceTime(): Date {
  return new Date();
}
