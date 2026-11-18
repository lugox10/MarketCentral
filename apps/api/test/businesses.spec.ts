import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { PrismaPg } from '@prisma/adapter-pg';
import prismaClientPkg from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';

// Mismo interop que `prisma.service.ts`: `@prisma/client` es CommonJS y el
// import con nombre solo resuelve en Node 24.
const PrismaClient = prismaClientPkg.PrismaClient;

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/marketcentral_test';

const unique = Date.now().toString(36);
const OWNER_EMAIL = `e2-owner-${unique}@marketcentral.test`;
const OTHER_EMAIL = `e2-other-${unique}@marketcentral.test`;
const ADMIN_EMAIL = `e2-admin-${unique}@marketcentral.test`;
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

const databaseIsAvailable = await databaseAvailable();

if (!databaseIsAvailable) {
  console.warn(
    '[businesses.spec] PostgreSQL no disponible en DATABASE_URL; los casos de integración se omiten. ' +
      'Ejecuta el contenedor y aplica las migraciones (ver README).',
  );
}

const describeIntegration = databaseIsAvailable ? describe : describe.skip;

describeIntegration('Businesses (E2) · integración con PostgreSQL', () => {
  let app: INestApplication;
  let ownerAgent: ReturnType<typeof request.agent>;
  let otherAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;
  let businessId = '';

  const server = (): ReturnType<typeof request> => request(app.getHttpServer());

  beforeAll(async () => {
    for (const plan of [
      {
        code: 'FREE' as const,
        name: 'Free',
        priceCop: 0,
        maxListings: 10,
        trialMonths: 2,
        billingPeriodDays: null,
      },
      {
        code: 'BASE' as const,
        name: 'Base',
        priceCop: 30_000,
        maxListings: 30,
        trialMonths: 0,
        billingPeriodDays: 30,
      },
      {
        code: 'PRO' as const,
        name: 'Pro',
        priceCop: 50_000,
        maxListings: 50,
        trialMonths: 0,
        billingPeriodDays: 30,
      },
    ]) {
      await prisma.plan.upsert({
        where: { code: plan.code },
        update: {
          name: plan.name,
          priceCop: plan.priceCop,
          maxListings: plan.maxListings,
          trialMonths: plan.trialMonths,
          billingPeriodDays: plan.billingPeriodDays,
        },
        create: { ...plan, currency: 'COP', isActive: true },
      });
    }

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    ownerAgent = request.agent(app.getHttpServer());
    otherAgent = request.agent(app.getHttpServer());
    adminAgent = request.agent(app.getHttpServer());

    const register = async (
      agent: ReturnType<typeof request.agent>,
      email: string,
    ): Promise<void> => {
      await agent
        .post('/auth/register')
        .send({ email, password: PASSWORD, name: 'Prueba E2' })
        .expect(201);
      await agent.post('/auth/login').send({ email, password: PASSWORD }).expect(200);
    };

    await register(ownerAgent, OWNER_EMAIL);
    await register(otherAgent, OTHER_EMAIL);
    await register(adminAgent, ADMIN_EMAIL);

    // El rol de plataforma solo lo cambia la administración, nunca la API pública.
    await prisma.user.update({ where: { email: ADMIN_EMAIL }, data: { role: 'SUPER_ADMIN' } });
    await adminAgent.post('/auth/logout').expect(204);
    await adminAgent
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: PASSWORD })
      .expect(200);
  }, 90_000);

  afterAll(async () => {
    if (databaseIsAvailable) {
      await prisma.business.deleteMany({ where: { slug: { startsWith: 'e2-' } } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'e2-' } } });
    }
    await prisma.$disconnect();
    if (app) await app.close();
  });

  it('POST /businesses crea negocio, membresía OWNER y suscripción TRIALING (201)', async () => {
    const response = await ownerAgent
      .post('/businesses')
      .send({
        name: 'Prendería La 70',
        city: 'MEDELLIN',
        addressLine: 'Calle 70 # 45-12',
        whatsapp: '3001234567',
      })
      .expect(201);

    businessId = response.body.business.id as string;
    expect(response.body.business).toMatchObject({
      name: 'Prendería La 70',
      city: 'MEDELLIN',
      whatsapp: '+573001234567',
      status: 'APPROVED',
    });
    expect(response.body.membershipRole).toBe('OWNER');
    expect(response.body.subscription).toMatchObject({
      status: 'TRIALING',
      plan: { code: 'FREE', name: 'Free', maxListings: 10, trialMonths: 2 },
    });

    const membership = await prisma.businessMembership.findFirst({
      where: { businessId, role: 'OWNER' },
      include: { user: true },
    });
    expect(membership?.user.email).toBe(OWNER_EMAIL);

    const persisted = await prisma.subscription.findUnique({ where: { businessId } });
    expect(persisted?.status).toBe('TRIALING');
    expect(persisted!.currentPeriodEnd.getTime()).toBeGreaterThan(
      persisted!.currentPeriodStart.getTime(),
    );
  }, 60_000);

  it('un segundo POST /businesses del mismo usuario responde 409', async () => {
    await ownerAgent
      .post('/businesses')
      .send({ name: 'Otra Prendería', city: 'BELLO', whatsapp: '3009998877' })
      .expect(409);
  });

  it('GET /businesses/me devuelve el negocio propio con su suscripción (200)', async () => {
    const response = await ownerAgent.get('/businesses/me').expect(200);
    expect(response.body.business.id).toBe(businessId);
    expect(response.body.subscription.plan.code).toBe('FREE');
  });

  it('GET /businesses/me de otro usuario responde 404 (aislamiento por sesión)', async () => {
    await otherAgent.get('/businesses/me').expect(404);
  });

  it('enviar businessId en el cuerpo se rechaza (400) y no cambia el tenant', async () => {
    const response = await ownerAgent
      .patch('/businesses/me')
      .send({ name: 'Prendería La 70', businessId: '00000000-0000-0000-0000-000000000000' })
      .expect(400);

    expect(String(response.body.message)).toContain('businessId');
    const own = await ownerAgent.get('/businesses/me').expect(200);
    expect(own.body.business.id).toBe(businessId);
  });

  it('PATCH /businesses/me actualiza el perfil del negocio propio (200)', async () => {
    const response = await ownerAgent
      .patch('/businesses/me')
      .send({ city: 'ENVIGADO', addressLine: 'Carrera 43 # 10-20', whatsapp: '+573105554433' })
      .expect(200);

    expect(response.body.business).toMatchObject({
      city: 'ENVIGADO',
      addressLine: 'Carrera 43 # 10-20',
      whatsapp: '+573105554433',
    });
  });

  it('ciudad fuera del AMVA responde 400', async () => {
    await ownerAgent.patch('/businesses/me').send({ city: 'BOGOTA' }).expect(400);
  });

  it('un BUSINESS_OWNER no puede listar /admin/businesses (403)', async () => {
    await ownerAgent.get('/admin/businesses').expect(403);
  });

  it('el SUPER_ADMIN lista los negocios y ve al dueño (200)', async () => {
    const response = await adminAgent.get('/admin/businesses').expect(200);
    const row = (response.body as Array<{ id: string; owner: { email: string } }>).find(
      (item) => item.id === businessId,
    );
    expect(row).toBeDefined();
    expect(row?.owner.email).toBe(OWNER_EMAIL);
  });

  it('el SUPER_ADMIN suspende y reactiva el negocio (200)', async () => {
    const suspended = await adminAgent
      .patch(`/admin/businesses/${businessId}/status`)
      .send({ status: 'SUSPENDED' })
      .expect(200);
    expect(suspended.body.status).toBe('SUSPENDED');

    const approved = await adminAgent
      .patch(`/admin/businesses/${businessId}/status`)
      .send({ status: 'APPROVED' })
      .expect(200);
    expect(approved.body.status).toBe('APPROVED');
  });

  it('sin sesión, /businesses/me responde 401', async () => {
    await server().get('/businesses/me').expect(401);
  });
});
