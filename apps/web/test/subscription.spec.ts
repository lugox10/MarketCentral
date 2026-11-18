import {
  ACTIVATION_LABELS,
  STATUS_LABELS,
  activateSubscription,
  fetchAdminSubscriptions,
  fetchActivationHistory,
  fetchMySubscription,
  fetchPlans,
  formatCop,
  newIdempotencyKey,
  planPeriodLabel,
} from '@/lib/subscription';
import { ApiError } from '@/lib/api';
import type { Plan } from '@/lib/business';

const planBase: Plan = {
  id: 'plan-base',
  code: 'BASE',
  name: 'Base',
  priceCop: 30000,
  currency: 'COP',
  maxListings: 30,
  maxCategories: 3,
  featuredSlots: 6,
  trialMonths: 0,
  trialDays: null,
  billingPeriodDays: 30,
  isActive: true,
};

const planFree: Plan = {
  ...planBase,
  id: 'plan-free',
  code: 'FREE',
  name: 'Free',
  priceCop: 0,
  maxListings: 10,
  trialMonths: 2,
  billingPeriodDays: null,
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>();

function lastCall(): [string, RequestInit?] {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error('fetch no fue invocado');
  return call;
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('contrato de suscripciones', () => {
  it('consulta los planes activos en el endpoint público', async () => {
    fetchMock.mockResolvedValue(jsonResponse([planFree, planBase]));

    const plans = await fetchPlans();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = lastCall();
    expect(String(url)).toMatch(/\/subscriptions\/plans$/);
    expect(init?.method).toBe('GET');
    expect(init?.credentials).toBe('include');
    expect(plans.map((plan) => plan.code)).toEqual(['FREE', 'BASE']);
  });

  it('consulta la suscripción propia sin aceptar un businessId del cliente', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'sub-1' }));

    await fetchMySubscription();

    const [url] = lastCall();
    expect(String(url)).toMatch(/\/subscriptions\/me$/);
    expect(String(url)).not.toContain('businessId');
  });

  it('construye la consulta administrativa con paginación y filtros', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ items: [], page: 2, limit: 10, total: 0, totalPages: 0 }),
    );

    await fetchAdminSubscriptions({
      page: 2,
      limit: 10,
      status: 'EXPIRED',
      plan: 'PRO',
      q: '  prenda  ',
    });

    const [url] = lastCall();
    const search = new URL(String(url)).searchParams;
    expect(String(url)).toContain('/admin/subscriptions?');
    expect(search.get('page')).toBe('2');
    expect(search.get('limit')).toBe('10');
    expect(search.get('status')).toBe('EXPIRED');
    expect(search.get('plan')).toBe('PRO');
    expect(search.get('q')).toBe('prenda');
  });

  it('omite los filtros vacíos en la consulta administrativa', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 }),
    );

    await fetchAdminSubscriptions({});

    const search = new URL(String(lastCall()[0])).searchParams;
    expect(search.get('page')).toBe('1');
    expect(search.get('limit')).toBe('20');
    expect(search.has('status')).toBe(false);
    expect(search.has('plan')).toBe(false);
    expect(search.has('q')).toBe(false);
  });

  it('envía la activación manual con nota e Idempotency-Key', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ subscription: {}, activation: {}, replayed: false }, 201),
    );

    await activateSubscription(
      'biz-1',
      { planId: 'plan-pro', note: 'Transferencia verificada' },
      'activate:abc',
    );

    const [url, init] = lastCall();
    expect(String(url)).toMatch(/\/admin\/subscriptions\/biz-1\/activate$/);
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['Idempotency-Key']).toBe('activate:abc');
    expect(JSON.parse(String(init?.body))).toEqual({
      planId: 'plan-pro',
      note: 'Transferencia verificada',
    });
  });

  it('consulta el historial de un negocio', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await fetchActivationHistory('biz-1');

    expect(String(lastCall()[0])).toMatch(/\/admin\/subscriptions\/biz-1\/history$/);
  });

  it('propaga el código de error del backend', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { statusCode: 409, error: 'IDEMPOTENCY_CONFLICT', message: 'Clave reutilizada' },
        409,
      ),
    );

    await expect(
      activateSubscription('biz-1', { planId: 'p', note: 'n' }, 'key:1'),
    ).rejects.toMatchObject({
      status: 409,
      code: 'IDEMPOTENCY_CONFLICT',
      message: 'Clave reutilizada',
    });

    await expect(
      activateSubscription('biz-1', { planId: 'p', note: 'n' }, 'key:1'),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('presentación de planes y estados', () => {
  it('etiqueta los estados y las activaciones en español', () => {
    expect(STATUS_LABELS.TRIALING).toBe('En prueba');
    expect(STATUS_LABELS.ACTIVE).toBe('Activa');
    expect(STATUS_LABELS.EXPIRED).toBe('Vencida');
    expect(ACTIVATION_LABELS.RENEWED).toBe('Renovación');
    expect(ACTIVATION_LABELS.PLAN_CHANGED).toBe('Cambio de plan');
  });

  it('formatea importes en pesos colombianos', () => {
    expect(formatCop(30000)).toContain('30.000');
    expect(formatCop(0)).toContain('COP');
  });

  it('describe la duración del plan según su modalidad', () => {
    expect(planPeriodLabel(planFree)).toBe('2 meses de prueba');
    expect(planPeriodLabel(planBase)).toBe('30 días');
    expect(planPeriodLabel({ ...planBase, billingPeriodDays: null, trialMonths: 0 })).toBe('—');
  });

  it('genera claves de idempotencia válidas y distintas', () => {
    const first = newIdempotencyKey('activate');
    const second = newIdempotencyKey('activate');

    expect(first).not.toBe(second);
    expect(first.length).toBeLessThanOrEqual(80);
    expect(first).toMatch(/^[A-Za-z0-9._:-]+$/);
  });
});
