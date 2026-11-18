import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { PrismaPg } from '@prisma/adapter-pg';
import prismaClientPkg from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { addCalendarMonths, DAY_MS } from '../src/common/utils/dates.js';
import type { SubscriptionRepository } from '../src/modules/subscriptions/application/ports.js';
import { SUBSCRIPTION_REPOSITORY } from '../src/modules/subscriptions/application/tokens.js';

// Mismo interop que `prisma.service.ts`: `@prisma/client` es CommonJS.
const PrismaClient = prismaClientPkg.PrismaClient;

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/marketcentral_test';

const uid = Date.now().toString(36);
const OWNER_EMAIL = `e4-owner-${uid}@marketcentral.test`;
const OTHER_EMAIL = `e4-other-${uid}@marketcentral.test`;
const ADMIN_EMAIL = `e4-admin-${uid}@marketcentral.test`;
const PASSWORD = 'ClaveSegura1';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

async function databaseAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

const describeIntegration = (await databaseAvailable()) ? describe : describe.skip;

describeIntegration('Subscriptions (E4) · integración con PostgreSQL', () => {
  let app: INestApplication;
  let ownerAgent: ReturnType<typeof request.agent>;
  let otherAgent: ReturnType<typeof request.agent>;
  let anonymous: ReturnType<typeof request>;
  let businessId = '';
  let otherBusinessId = '';
  let verticalId = '';
  let basePlanId = '';
  let proPlanId = '';
  let freePlanId = '';

  beforeAll(async () => {
    // Restos de ejecuciones anteriores en la base de pruebas (determinismo).
    await prisma.business.deleteMany({ where: { name: { startsWith: 'Prendería E4' } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e4-' } } });

    for (const plan of [
      {
        code: 'FREE' as const,
        name: 'Free',
        priceCop: 0,
        maxListings: 10,
        maxCategories: 0,
        featuredSlots: 3,
        trialMonths: 2,
        trialDays: null,
        billingPeriodDays: null,
      },
      {
        code: 'BASE' as const,
        name: 'Base',
        priceCop: 30_000,
        maxListings: 30,
        maxCategories: 3,
        featuredSlots: 6,
        trialMonths: 0,
        trialDays: null,
        billingPeriodDays: 30,
      },
      {
        code: 'PRO' as const,
        name: 'Pro',
        priceCop: 50_000,
        maxListings: 50,
        maxCategories: 5,
        featuredSlots: 10,
        trialMonths: 0,
        trialDays: null,
        billingPeriodDays: 30,
      },
    ]) {
      await prisma.plan.upsert({
        where: { code: plan.code },
        update: {
          name: plan.name,
          priceCop: plan.priceCop,
          maxListings: plan.maxListings,
          maxCategories: plan.maxCategories,
          featuredSlots: plan.featuredSlots,
          trialMonths: plan.trialMonths,
          trialDays: plan.trialDays,
          billingPeriodDays: plan.billingPeriodDays,
          isActive: true,
        },
        create: { ...plan, currency: 'COP', isActive: true },
      });
    }

    verticalId = (
      await prisma.vertical.upsert({
        where: { slug: 'prenderias' },
        update: {},
        create: { name: 'Prenderías', slug: 'prenderias', isActive: true },
      })
    ).id;

    freePlanId = (await prisma.plan.findUniqueOrThrow({ where: { code: 'FREE' } })).id;
    basePlanId = (await prisma.plan.findUniqueOrThrow({ where: { code: 'BASE' } })).id;
    proPlanId = (await prisma.plan.findUniqueOrThrow({ where: { code: 'PRO' } })).id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    ownerAgent = request.agent(app.getHttpServer());
    otherAgent = request.agent(app.getHttpServer());
    const adminAgent = request.agent(app.getHttpServer());
    anonymous = request(app.getHttpServer());

    const register = async (agent: ReturnType<typeof request.agent>, email: string) => {
      await agent
        .post('/auth/register')
        .send({ email, password: PASSWORD, name: 'Prueba E4' })
        .expect(201);
      await agent.post('/auth/login').send({ email, password: PASSWORD }).expect(200);
    };

    await register(ownerAgent, OWNER_EMAIL);
    await register(otherAgent, OTHER_EMAIL);
    await register(adminAgent, ADMIN_EMAIL);

    await prisma.user.update({ where: { email: ADMIN_EMAIL }, data: { role: 'SUPER_ADMIN' } });
    await adminAgent.post('/auth/logout').expect(204);
    await adminAgent
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: PASSWORD })
      .expect(200);
    adminAgentRef = adminAgent;
  }, 90_000);

  let adminAgentRef: ReturnType<typeof request.agent>;

  afterAll(async () => {
    const ids = [businessId, otherBusinessId].filter((id) => id.length > 0);
    if (ids.length > 0) {
      await prisma.business.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e4-' } } });
    await prisma.plan.update({ where: { code: 'BASE' }, data: { isActive: true } });
    await prisma.$disconnect();
    if (app) await app.close();
  });

  it('un negocio nuevo recibe Free TRIALING con vencimiento a dos meses calendario', async () => {
    const response = await ownerAgent
      .post('/businesses')
      .send({
        verticalId,
        name: 'Prendería E4 Uno',
        city: 'MEDELLIN',
        addressLine: 'Calle 70 # 45-12',
        whatsapp: '3001234567',
      })
      .expect(201);

    businessId = response.body.business.id as string;
    expect(response.body.subscription).toMatchObject({
      status: 'TRIALING',
      plan: { code: 'FREE', maxListings: 10, trialMonths: 2 },
    });

    const persisted = await prisma.subscription.findUniqueOrThrow({ where: { businessId } });
    const expectedEnd = addCalendarMonths(persisted.currentPeriodStart, 2);
    expect(persisted.status).toBe('TRIALING');
    expect(Math.abs(persisted.currentPeriodEnd.getTime() - expectedEnd.getTime())).toBeLessThan(
      2000,
    );
  }, 60_000);

  it('el provisionamiento Free es idempotente y no crea una segunda suscripción', async () => {
    const repository = app.get<SubscriptionRepository>(SUBSCRIPTION_REPOSITORY);
    const before = await prisma.subscription.count({ where: { businessId } });

    const first = await repository.ensureFreeSubscription({
      businessId,
      planId: freePlanId,
      periodStart: new Date(),
      periodEnd: addCalendarMonths(new Date(), 2),
    });
    const second = await repository.ensureFreeSubscription({
      businessId,
      planId: freePlanId,
      periodStart: new Date(),
      periodEnd: addCalendarMonths(new Date(), 2),
    });

    const after = await prisma.subscription.count({ where: { businessId } });
    expect(after).toBe(before);
    expect(second.id).toBe(first.id);
  }, 30_000);

  it('GET /subscriptions/me devuelve plan, estado, fechas y días restantes', async () => {
    const response = await ownerAgent.get('/subscriptions/me').expect(200);

    expect(response.body).toMatchObject({
      id: expect.any(String) as string,
      business: { id: businessId },
      plan: { code: 'FREE', priceCop: 0, currency: 'COP', maxListings: 10 },
      status: 'TRIALING',
      isExpired: false,
      remainingDays: expect.any(Number) as number,
    });
    expect(response.body.remainingDays).toBeGreaterThan(50);
  }, 30_000);

  it('un usuario sin negocio recibe 404 y no puede consultar la suscripción de otro negocio', async () => {
    const otherResponse = await otherAgent.get('/subscriptions/me').expect(404);
    expect(otherResponse.body.error).toBe('BUSINESS_NOT_FOUND');

    // El negocio sale de la membresía: intentar forzarlo por query no cambia el resultado.
    const created = await otherAgent
      .post('/businesses')
      .send({
        verticalId,
        name: 'Prendería E4 Ajena',
        city: 'BELLO',
        addressLine: 'Carrera 50 # 30-10',
        whatsapp: '3009998877',
      })
      .expect(201);
    otherBusinessId = created.body.business.id as string;

    const forced = await ownerAgent
      .get(`/subscriptions/me?businessId=${otherBusinessId}`)
      .expect(200);
    expect(forced.body.business.id).toBe(businessId);
  }, 60_000);

  it('SUPER_ADMIN activa Base manualmente y deja historial atómico', async () => {
    const before = new Date();
    const response = await adminAgentRef
      .post(`/admin/subscriptions/${businessId}/activate`)
      .set('Idempotency-Key', `e4-base-${uid}`)
      .send({ planId: basePlanId, note: 'Pago verificado por transferencia. Ref. 1001.' })
      .expect(201);

    expect(response.body.replayed).toBe(false);
    expect(response.body.subscription).toMatchObject({
      plan: { code: 'BASE', priceCop: 30_000, currency: 'COP', maxListings: 30 },
      status: 'ACTIVE',
      isExpired: false,
    });

    const end = new Date(response.body.subscription.currentPeriodEnd as string);
    expect(Math.abs(end.getTime() - (before.getTime() + 30 * DAY_MS))).toBeLessThan(15_000);

    const persisted = await prisma.subscription.findUniqueOrThrow({ where: { businessId } });
    expect(persisted.status).toBe('ACTIVE');
    expect(persisted.planId).toBe(basePlanId);
    expect(persisted.activationNote).toContain('Ref. 1001');
    expect(persisted.activatedByAdminId).toBe(
      (await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } })).id,
    );

    const history = await prisma.subscriptionActivation.findMany({
      where: { subscriptionId: persisted.id },
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ kind: 'ACTIVATED', planId: basePlanId, priceCop: 30_000 });
  }, 60_000);

  it('repetir la misma Idempotency-Key devuelve el resultado original sin extender el periodo', async () => {
    const key = `e4-replay-${uid}`;
    const payload = { planId: basePlanId, note: 'Renovación verificada. Ref. 2002.' };

    const first = await adminAgentRef
      .post(`/admin/subscriptions/${businessId}/activate`)
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    const second = await adminAgentRef
      .post(`/admin/subscriptions/${businessId}/activate`)
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);

    expect(first.body.replayed).toBe(false);
    expect(second.body.replayed).toBe(true);
    expect(second.body.subscription.currentPeriodEnd).toBe(
      first.body.subscription.currentPeriodEnd,
    );

    const activations = await prisma.subscriptionActivation.count({
      where: { idempotencyKey: key },
    });
    expect(activations).toBe(1);

    // La misma clave con otro contenido debe ser un conflicto, no una segunda extensión.
    await adminAgentRef
      .post(`/admin/subscriptions/${businessId}/activate`)
      .set('Idempotency-Key', key)
      .send({ planId: proPlanId, note: 'Otra nota distinta' })
      .expect(409);

    const persisted = await prisma.subscription.findUniqueOrThrow({ where: { businessId } });
    expect(persisted.currentPeriodEnd.toISOString()).toBe(first.body.subscription.currentPeriodEnd);
  }, 60_000);

  it('la renovación anticipada conserva los días vigentes y agrega 30', async () => {
    const current = await prisma.subscription.findUniqueOrThrow({ where: { businessId } });
    const previousEnd = current.currentPeriodEnd;

    const response = await adminAgentRef
      .post(`/admin/subscriptions/${businessId}/activate`)
      .set('Idempotency-Key', `e4-renew-${uid}`)
      .send({ planId: basePlanId, note: 'Renovación anticipada verificada.' })
      .expect(201);

    const newEnd = new Date(response.body.subscription.currentPeriodEnd as string);
    expect(newEnd.getTime() - previousEnd.getTime()).toBe(30 * DAY_MS);
    expect(response.body.activation.kind).toBe('RENEWED');
    expect(response.body.activation.previousPeriodEnd).toBe(previousEnd.toISOString());
  }, 60_000);

  it('el cambio Base→Pro es inmediato y aplica el límite de 50 publicaciones', async () => {
    const current = await prisma.subscription.findUniqueOrThrow({ where: { businessId } });
    const previousEnd = current.currentPeriodEnd;

    const response = await adminAgentRef
      .post(`/admin/subscriptions/${businessId}/activate`)
      .set('Idempotency-Key', `e4-plan-change-${uid}`)
      .send({ planId: proPlanId, note: 'Diferencia de plan cobrada externamente.' })
      .expect(201);

    expect(response.body.subscription.plan).toMatchObject({ code: 'PRO', maxListings: 50 });
    expect(response.body.activation.kind).toBe('PLAN_CHANGED');
    const newEnd = new Date(response.body.subscription.currentPeriodEnd as string);
    expect(newEnd.getTime() - previousEnd.getTime()).toBe(30 * DAY_MS);
  }, 60_000);

  it('el historial administrativo conserva las activaciones del negocio', async () => {
    const response = await adminAgentRef
      .get(`/admin/subscriptions/${businessId}/history`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(4);
    expect(response.body[0]).toMatchObject({
      planCode: 'PRO',
      adminName: expect.any(String) as string,
    });
  }, 30_000);

  it('rechaza planes no pagados, notas vacías, planes y negocios inexistentes', async () => {
    await adminAgentRef
      .post(`/admin/subscriptions/${businessId}/activate`)
      .send({ planId: freePlanId, note: 'Intento de activar Free' })
      .expect(400);
    await adminAgentRef
      .post(`/admin/subscriptions/${businessId}/activate`)
      .send({ planId: basePlanId, note: '   ' })
      .expect(400);
    await adminAgentRef
      .post(`/admin/subscriptions/${businessId}/activate`)
      .send({ planId: '00000000-0000-4000-8000-000000000000', note: 'Plan fantasma' })
      .expect(404);
    await adminAgentRef
      .post('/admin/subscriptions/00000000-0000-4000-8000-000000000000/activate')
      .send({ planId: basePlanId, note: 'Negocio fantasma' })
      .expect(404);

    await prisma.plan.update({ where: { code: 'BASE' }, data: { isActive: false } });
    await adminAgentRef
      .post(`/admin/subscriptions/${businessId}/activate`)
      .send({ planId: basePlanId, note: 'Plan desactivado' })
      .expect(400);
    await prisma.plan.update({ where: { code: 'BASE' }, data: { isActive: true } });
  }, 60_000);

  it('si falla la escritura del historial no se modifica la suscripción (atomicidad)', async () => {
    const repository = app.get<SubscriptionRepository>(SUBSCRIPTION_REPOSITORY);
    const before = await prisma.subscription.findUniqueOrThrow({ where: { businessId } });
    const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'PRO' } });
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });

    await expect(
      repository.activate({
        subscriptionId: before.id,
        adminId: admin.id,
        plan: {
          id: plan.id,
          code: plan.code,
          name: plan.name,
          priceCop: plan.priceCop,
          currency: plan.currency,
          maxListings: plan.maxListings,
          maxCategories: plan.maxCategories,
          featuredSlots: plan.featuredSlots,
          trialMonths: plan.trialMonths,
          trialDays: plan.trialDays,
          billingPeriodDays: plan.billingPeriodDays,
          isActive: plan.isActive,
        },
        note: 'x'.repeat(600),
        kind: 'RENEWED',
        periodStart: before.currentPeriodStart,
        previousPeriodEnd: before.currentPeriodEnd,
        newPeriodEnd: new Date(before.currentPeriodEnd.getTime() + 30 * DAY_MS),
        idempotencyKey: null,
        requestHash: 'a'.repeat(64),
        activatedAt: new Date(),
      }),
    ).rejects.toThrow();

    const after = await prisma.subscription.findUniqueOrThrow({ where: { businessId } });
    expect(after.currentPeriodEnd.toISOString()).toBe(before.currentPeriodEnd.toISOString());
    expect(after.planId).toBe(before.planId);
    expect(after.activationNote).toBe(before.activationNote);
  }, 60_000);

  it('una suscripción vencida se consulta como EXPIRED, sin renovación automática', async () => {
    const pastStart = new Date(Date.now() - 33 * DAY_MS);
    const past = new Date(Date.now() - 3 * DAY_MS);
    await prisma.subscription.update({
      where: { businessId: otherBusinessId },
      data: { status: 'TRIALING', currentPeriodStart: pastStart, currentPeriodEnd: past },
    });

    const response = await otherAgent.get('/subscriptions/me').expect(200);
    expect(response.body).toMatchObject({ status: 'EXPIRED', isExpired: true, remainingDays: 0 });
    expect(response.body.plan.code).toBe('FREE');

    const persisted = await prisma.subscription.findUniqueOrThrow({
      where: { businessId: otherBusinessId },
    });
    expect(persisted.status).toBe('EXPIRED');
    expect(persisted.currentPeriodEnd.getTime()).toBe(past.getTime());
  }, 30_000);

  it('protege el panel administrativo: 403 para BUSINESS_OWNER y 401 sin sesión', async () => {
    await ownerAgent.get('/admin/subscriptions').expect(403);
    await ownerAgent
      .post(`/admin/subscriptions/${otherBusinessId}/activate`)
      .send({ planId: basePlanId, note: 'No autorizado' })
      .expect(403);
    await anonymous.get('/admin/subscriptions').expect(401);
    await anonymous
      .post(`/admin/subscriptions/${businessId}/activate`)
      .send({ planId: basePlanId, note: 'Sin sesión' })
      .expect(401);
    await anonymous.get('/subscriptions/me').expect(401);
    await adminAgentRef.get('/admin/subscriptions').expect(200);
  }, 30_000);

  it('el listado administrativo pagina, filtra y no expone correos de propietarios', async () => {
    const page = await adminAgentRef
      .get('/admin/subscriptions?page=1&limit=1&status=ACTIVE&plan=PRO')
      .expect(200);

    expect(page.body.page).toBe(1);
    expect(page.body.limit).toBe(1);
    expect(page.body.totalPages).toBeGreaterThanOrEqual(1);
    expect(page.body.items.length).toBeLessThanOrEqual(1);
    if (page.body.items.length > 0) {
      expect(page.body.items[0]).toMatchObject({ status: 'ACTIVE', plan: { code: 'PRO' } });
      expect(page.body.items[0]).not.toHaveProperty('email');
      expect(JSON.stringify(page.body)).not.toContain('@marketcentral.test');
    }

    const search = await adminAgentRef.get('/admin/subscriptions?q=Ajena&limit=100').expect(200);
    expect(search.body.total).toBe(1);
    expect(search.body.items[0].businessName).toBe('Prendería E4 Ajena');

    await adminAgentRef.get('/admin/subscriptions?limit=500').expect(400);
    await adminAgentRef.get('/admin/subscriptions?status=INVENTADO').expect(400);
  }, 30_000);

  it('GET /subscriptions/plans es público y devuelve los tres planes con sus límites', async () => {
    const response = await anonymous.get('/subscriptions/plans').expect(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'FREE', priceCop: 0, maxListings: 10 }),
        expect.objectContaining({ code: 'BASE', priceCop: 30_000, maxListings: 30 }),
        expect.objectContaining({ code: 'PRO', priceCop: 50_000, maxListings: 50 }),
      ]),
    );
  }, 30_000);
});
