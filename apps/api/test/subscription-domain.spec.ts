import { addCalendarMonths, addUtcDays, DAY_MS } from '../src/common/utils/dates.js';
import {
  assertPayablePlan,
  computeActivationSchedule,
  effectiveStatus,
  normalizeActivationNote,
  normalizeIdempotencyKey,
  remainingDays,
} from '../src/modules/subscriptions/domain/subscription.js';
import type { PlanSnapshot } from '../src/modules/subscriptions/domain/subscription.js';
import { SubscriptionError } from '../src/modules/subscriptions/domain/subscription-error.js';

const PAID_PLAN: PlanSnapshot = {
  id: 'plan-base',
  code: 'BASE',
  priceCop: 30_000,
  currency: 'COP',
  billingPeriodDays: 30,
  isActive: true,
};

const PRO_PLAN: PlanSnapshot = { ...PAID_PLAN, id: 'plan-pro', code: 'PRO', priceCop: 50_000 };

const FREE_PLAN: PlanSnapshot = {
  id: 'plan-free',
  code: 'FREE',
  priceCop: 0,
  currency: 'COP',
  billingPeriodDays: null,
  isActive: true,
};

describe('Fechas de suscripción (E4)', () => {
  it('la prueba Free suma dos meses calendario, no 60 días', () => {
    const start = new Date('2026-11-14T12:00:00.000Z');
    expect(addCalendarMonths(start, 2).toISOString()).toBe('2027-01-14T12:00:00.000Z');
    expect(addCalendarMonths(start, 2).getTime()).not.toBe(start.getTime() + 60 * DAY_MS);
  });

  it('ajusta al último día del mes destino: 31 de enero + 1 mes', () => {
    expect(addCalendarMonths(new Date('2027-01-31T08:30:00.000Z'), 1).toISOString()).toBe(
      '2027-02-28T08:30:00.000Z',
    );
  });

  it('respeta el 29 de febrero en año bisiesto', () => {
    expect(addCalendarMonths(new Date('2028-01-31T00:00:00.000Z'), 1).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
  });

  it('cruza el fin de año: 31 de diciembre + 2 meses', () => {
    expect(addCalendarMonths(new Date('2026-12-31T23:00:00.000Z'), 2).toISOString()).toBe(
      '2027-02-28T23:00:00.000Z',
    );
  });

  it('la activación pagada suma 30 periodos de 24 horas exactas', () => {
    const start = new Date('2026-11-14T12:00:00.000Z');
    expect(addUtcDays(start, 30).toISOString()).toBe('2026-12-14T12:00:00.000Z');
  });
});

describe('Estado efectivo y días restantes (E4)', () => {
  const now = new Date('2026-11-14T12:00:00.000Z');

  it('una suscripción con periodo vencido se reporta EXPIRED aunque el registro diga ACTIVE', () => {
    expect(effectiveStatus('ACTIVE', new Date('2026-11-14T11:59:59.000Z'), now)).toBe('EXPIRED');
    expect(effectiveStatus('TRIALING', new Date('2026-11-14T12:00:00.000Z'), now)).toBe('EXPIRED');
  });

  it('mantiene el estado cuando el periodo sigue vigente', () => {
    expect(effectiveStatus('TRIALING', new Date('2027-01-14T12:00:00.000Z'), now)).toBe('TRIALING');
  });

  it('redondea los días restantes hacia arriba y devuelve 0 al vencer', () => {
    expect(remainingDays(new Date('2026-11-15T13:00:00.000Z'), now)).toBe(2);
    expect(remainingDays(new Date('2026-11-14T12:00:00.000Z'), now)).toBe(0);
    expect(remainingDays(new Date('2026-11-01T12:00:00.000Z'), now)).toBe(0);
  });
});

describe('Cálculo de activación (D-37)', () => {
  const now = new Date('2026-11-14T12:00:00.000Z');

  it('renueva una suscripción ACTIVE vigente sumando 30 días al vencimiento actual', () => {
    const schedule = computeActivationSchedule(
      {
        status: 'ACTIVE',
        currentPeriodStart: new Date('2026-11-01T12:00:00.000Z'),
        currentPeriodEnd: new Date('2026-12-01T12:00:00.000Z'),
        planId: PAID_PLAN.id,
      },
      PAID_PLAN,
      now,
    );

    expect(schedule.kind).toBe('RENEWED');
    expect(schedule.periodStart.toISOString()).toBe('2026-11-01T12:00:00.000Z');
    expect(schedule.previousPeriodEnd.toISOString()).toBe('2026-12-01T12:00:00.000Z');
    expect(schedule.newPeriodEnd.toISOString()).toBe('2026-12-31T12:00:00.000Z');
  });

  it('marca PLAN_CHANGED al pasar de Base a Pro conservando los días vigentes', () => {
    const schedule = computeActivationSchedule(
      {
        status: 'ACTIVE',
        currentPeriodStart: new Date('2026-11-01T12:00:00.000Z'),
        currentPeriodEnd: new Date('2026-12-01T12:00:00.000Z'),
        planId: PAID_PLAN.id,
      },
      PRO_PLAN,
      now,
    );

    expect(schedule.kind).toBe('PLAN_CHANGED');
    expect(schedule.newPeriodEnd.toISOString()).toBe('2026-12-31T12:00:00.000Z');
  });

  it('inicia el periodo pagado al activar desde TRIALING', () => {
    const schedule = computeActivationSchedule(
      {
        status: 'TRIALING',
        currentPeriodStart: new Date('2026-10-14T12:00:00.000Z'),
        currentPeriodEnd: new Date('2026-12-14T12:00:00.000Z'),
        planId: FREE_PLAN.id,
      },
      PAID_PLAN,
      now,
    );

    expect(schedule.kind).toBe('ACTIVATED');
    expect(schedule.periodStart.toISOString()).toBe(now.toISOString());
    expect(schedule.newPeriodEnd.toISOString()).toBe('2026-12-14T12:00:00.000Z');
  });

  it('trata una ACTIVE ya vencida como vencida y empieza desde ahora', () => {
    const schedule = computeActivationSchedule(
      {
        status: 'ACTIVE',
        currentPeriodStart: new Date('2026-10-01T12:00:00.000Z'),
        currentPeriodEnd: new Date('2026-10-31T12:00:00.000Z'),
        planId: PAID_PLAN.id,
      },
      PAID_PLAN,
      now,
    );

    expect(schedule.kind).toBe('ACTIVATED');
    expect(schedule.newPeriodEnd.toISOString()).toBe('2026-12-14T12:00:00.000Z');
  });
});

describe('Reglas de plan y validaciones (E4)', () => {
  it('rechaza activar el plan Free con cobro manual', () => {
    expect(() => assertPayablePlan(FREE_PLAN)).toThrow(SubscriptionError);
    try {
      assertPayablePlan(FREE_PLAN);
    } catch (error) {
      expect((error as SubscriptionError).code).toBe('PLAN_NOT_PAYABLE');
    }
  });

  it('rechaza un plan pagado inactivo', () => {
    expect(() => assertPayablePlan({ ...PAID_PLAN, isActive: false })).toThrow(SubscriptionError);
  });

  it('exige una nota no vacía y la recorta', () => {
    expect(normalizeActivationNote('  Pago verificado  ')).toBe('Pago verificado');
    expect(() => normalizeActivationNote('   ')).toThrow(SubscriptionError);
    expect(() => normalizeActivationNote('x'.repeat(501))).toThrow(SubscriptionError);
  });

  it('valida el formato de Idempotency-Key', () => {
    expect(normalizeIdempotencyKey(undefined)).toBeNull();
    expect(normalizeIdempotencyKey('  ')).toBeNull();
    expect(() => normalizeIdempotencyKey('abc-123')).toThrow(SubscriptionError);
    expect(normalizeIdempotencyKey('attempt:001-abc')).toBe('attempt:001-abc');
    expect(() => normalizeIdempotencyKey('clave con espacios')).toThrow(SubscriptionError);
  });
});
