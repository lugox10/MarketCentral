import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { PrismaPg } from '@prisma/adapter-pg';
import prismaClientPkg from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';

const PrismaClient = prismaClientPkg.PrismaClient;

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/marketcentral_test';

const unique = Date.now().toString(36);
const OWNER_EMAIL = `e5cat-owner-${unique}@marketcentral.test`;
const OTHER_EMAIL = `e5cat-other-${unique}@marketcentral.test`;
const ADMIN_EMAIL = `e5cat-admin-${unique}@marketcentral.test`;
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
  console.warn('[business-categories.spec] PostgreSQL no disponible; se omiten los casos.');
}

const describeIntegration = databaseIsAvailable ? describe : describe.skip;

describeIntegration('Categorías propias (E5 · Fase 2) · integración', () => {
  let app: INestApplication;
  let ownerAgent: ReturnType<typeof request.agent>;
  let otherAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;
  let businessId = '';
  let otherBusinessId = '';
  let verticalId = '';
  let basePlanId = '';
  let globalCategoryId = '';

  beforeAll(async () => {
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
        },
        create: { ...plan, currency: 'COP', isActive: true },
      });
    }

    const vertical = await prisma.vertical.upsert({
      where: { slug: 'prenderias' },
      update: {},
      create: { name: 'Prenderías', slug: 'prenderias', isActive: true },
    });
    verticalId = vertical.id;

    const basePlan = await prisma.plan.findUniqueOrThrow({ where: { code: 'BASE' } });
    basePlanId = basePlan.id;

    // Categoría global para comprobar que duplicar su nombre está permitido.
    const globalCategory = await prisma.category.create({
      data: {
        verticalId,
        name: `Global ${unique}`,
        slug: `global-${unique}`,
        businessId: null,
      },
    });
    globalCategoryId = globalCategory.id;

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
        .send({ email, password: PASSWORD, name: 'Categorías E5' })
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

    const ownerBusiness = await ownerAgent
      .post('/businesses')
      .send({
        verticalId,
        name: `Prendería Cat ${unique}`,
        city: 'MEDELLIN',
        addressLine: 'Calle 10 # 20-30',
        whatsapp: '3005550001',
      })
      .expect(201);
    businessId = ownerBusiness.body.business.id as string;

    const otherBusiness = await otherAgent
      .post('/businesses')
      .send({
        verticalId,
        name: `Prendería Cat Otra ${unique}`,
        city: 'ITAGUI',
        addressLine: 'Carrera 20 # 30-40',
        whatsapp: '3005550002',
      })
      .expect(201);
    otherBusinessId = otherBusiness.body.business.id as string;
  }, 120_000);

  afterAll(async () => {
    if (databaseIsAvailable) {
      await prisma.business.deleteMany({ where: { owner: { email: { startsWith: 'e5cat-' } } } });
      await prisma.category.deleteMany({ where: { slug: `global-${unique}` } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'e5cat-' } } });
    }
    await prisma.$disconnect();
    if (app) await app.close();
  });

  it('el plan Free no incluye categorías propias (limit 0, canCreate false)', async () => {
    const response = await ownerAgent.get('/businesses/me/categories').expect(200);
    expect(response.body).toMatchObject({ used: 0, limit: 0, canCreate: false, planCode: 'FREE' });
    expect(response.body.upgradeHint.length).toBeGreaterThan(20);
  });

  it('crear una categoría en Free responde 409 CATEGORY_LIMIT_REACHED', async () => {
    const response = await ownerAgent
      .post('/businesses/me/categories')
      .send({ name: 'Celulares' })
      .expect(409);
    expect(response.body.error).toBe('CATEGORY_LIMIT_REACHED');
  });

  it('tras activar Base el cupo pasa a 3 y se puede crear una categoría', async () => {
    await adminAgent
      .post(`/admin/subscriptions/${businessId}/activate`)
      .send({ planId: basePlanId, note: 'Prueba E5 Fase 2' })
      .expect(201);

    const created = await ownerAgent
      .post('/businesses/me/categories')
      .send({ name: 'Celulares gama media', parentId: globalCategoryId })
      .expect(201);

    expect(created.body).toMatchObject({ used: 1, limit: 3, remaining: 2, canCreate: true });
    expect(created.body.items[0]).toMatchObject({
      name: 'Celulares gama media',
      slug: 'celulares-gama-media',
      isActive: true,
      parentId: globalCategoryId,
    });

    const persisted = await prisma.category.findFirst({
      where: { businessId, name: 'Celulares gama media' },
    });
    expect(persisted?.verticalId).toBe(verticalId);
  });

  it('duplicar el nombre de una categoría global está permitido', async () => {
    const global = await prisma.category.findUniqueOrThrow({ where: { id: globalCategoryId } });
    const response = await ownerAgent
      .post('/businesses/me/categories')
      .send({ name: global.name })
      .expect(201);
    expect(response.body.used).toBe(2);
  });

  it('un nombre repetido dentro del mismo negocio responde 409 DUPLICATE_CATEGORY', async () => {
    const response = await ownerAgent
      .post('/businesses/me/categories')
      .send({ name: 'Celulares gama media' })
      .expect(409);
    expect(response.body.error).toBe('DUPLICATE_CATEGORY');
  });

  it('al llenar el cupo (3) la cuarta categoría responde 409', async () => {
    await ownerAgent.post('/businesses/me/categories').send({ name: 'Tabletas' }).expect(201);
    const response = await ownerAgent
      .post('/businesses/me/categories')
      .send({ name: 'Computadores' })
      .expect(409);
    expect(response.body.error).toBe('CATEGORY_LIMIT_REACHED');
  });

  it('desactivar libera cupo y reactivar sin cupo responde 409', async () => {
    const list = await ownerAgent.get('/businesses/me/categories').expect(200);
    const target = (list.body.items as Array<{ id: string; isActive: boolean }>).find(
      (item) => item.isActive,
    );
    expect(target).toBeDefined();

    const off = await ownerAgent
      .patch(`/businesses/me/categories/${target!.id}`)
      .send({ isActive: false })
      .expect(200);
    expect(off.body.used).toBe(2);

    await ownerAgent.post('/businesses/me/categories').send({ name: 'Consolas' }).expect(201);

    const blocked = await ownerAgent
      .patch(`/businesses/me/categories/${target!.id}`)
      .send({ isActive: true })
      .expect(409);
    expect(blocked.body.error).toBe('CATEGORY_LIMIT_REACHED');
  });

  it('no se puede editar una categoría de otro negocio (403 CATEGORY_NOT_OWNED)', async () => {
    const otherList = await otherAgent.get('/businesses/me/categories').expect(200);
    expect(otherList.body.limit).toBe(0);

    const own = await prisma.category.findFirstOrThrow({ where: { businessId } });
    const response = await otherAgent
      .patch(`/businesses/me/categories/${own.id}`)
      .send({ name: 'Intento ajeno' })
      .expect(403);
    expect(response.body.error).toBe('CATEGORY_NOT_OWNED');
  });

  it('un padre de otra vertical responde 400 INVALID_CATEGORY_PARENT', async () => {
    const otherVertical = await prisma.vertical.upsert({
      where: { slug: 'joyerias' },
      update: {},
      create: { name: 'Joyerías', slug: 'joyerias', isActive: true },
    });
    const foreign = await prisma.category.create({
      data: {
        verticalId: otherVertical.id,
        name: 'Anillos',
        slug: `anillos-${unique}`,
        businessId: null,
      },
    });

    const response = await ownerAgent
      .post('/businesses/me/categories')
      .send({ name: 'Categoría inválida', parentId: foreign.id })
      .expect(400);
    expect(response.body.error).toBe('INVALID_CATEGORY_PARENT');

    await prisma.category.delete({ where: { id: foreign.id } });
  });

  it('sin sesión responde 401', async () => {
    await request(app.getHttpServer()).get('/businesses/me/categories').expect(401);
  });

  it('el negocio ajeno sigue con 0 categorías propias', async () => {
    const count = await prisma.category.count({ where: { businessId: otherBusinessId } });
    expect(count).toBe(0);
  });
});
