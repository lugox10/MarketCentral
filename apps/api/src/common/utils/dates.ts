/**
 * Utilidades de fecha compartidas por los módulos de negocio.
 *
 * Todo el cálculo se hace en UTC: la API persiste `timestamptz` y solo el
 * frontend presenta en `America/Bogota`. Nunca se usa el reloj del navegador.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

function daysInMonth(year: number, monthIndex: number): number {
  // El día 0 del mes siguiente es el último día del mes indicado.
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Suma meses **calendario** conservando la hora UTC.
 *
 * Si el día de origen no existe en el mes destino se ajusta al último día
 * disponible: 31-ene + 1 mes → 28/29-feb; 30-nov + 2 meses → 30-ene.
 * Así la prueba de dos meses del plan Free vence en la misma fecha dos meses
 * después, no en 60 días fijos.
 */
export function addCalendarMonths(from: Date, months: number): Date {
  const targetMonthIndex = from.getUTCMonth() + months;
  const targetYear = from.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const day = Math.min(from.getUTCDate(), daysInMonth(targetYear, targetMonth));

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      day,
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
}

/** Suma días exactos de 24 horas (activación pagada de 30 días). */
export function addUtcDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}
