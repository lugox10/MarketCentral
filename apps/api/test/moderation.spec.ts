process.env.IP_HASH_SECRET = 'test-ip-hash-secret';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/marketcentral_test';

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import prismaClientPkg from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PrismaClientCtor = prismaClientPkg.PrismaClient;

const UNIQUE = Date.now().toString(36);
const PASSWORD = 'Prueba1234!';
const OWNER_EMAIL = `e8-owner-${UNIQUE}@marketcentral.test`;
const ADMIN_EMAIL = `e8-admin-${UNIQUE}@marketcentral.test`;

async function databaseAvailable(): Promise<boolean> {
  const probe = new PrismaClientCtor({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  }) as PrismaClient;
  try {
    await probe.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await probe.$disconnect();
  }
}

const describeIntegration = (await databaseAvailable()) ? describe : describe.skip;

interface Fixture {
  businessId: string;
  businessSlug: string;
  listingId: string;
  listingSlug: string;
  draftListingId: string;
  ownerUserId: string;
  categoryId: string;
  verticalId: string;
}

describeIntegration('E8 · moderación y reportes (integración)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let ownerAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;
  let anonymous: ReturnType<typeof request.agent>;
  let fixture: Fixture;

  const reportOnListing = (overrides: Record<string, unknown> = {}) => ({
    businessSlug: fixture.businessSlug,
    listingSlug: fixture.listingSlug,
    reason: 'SCAM',
    details: 'Pide un anticipo por transferencia antes de mostrar el artículo.',
    website: '',
    ...overrides,
  });

  beforeAll(async () => {
    prisma = new PrismaClientCtor({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    }) as PrismaClient;

    const vertical = await prisma.vertical.upsert({
      where: { slug: 'prenderias' },
      update: {},
      create: { name: 'Prenderías', slug: 'prenderias' },
    });
    const category = await prisma.category.create({
      data: {
        verticalId: vertical.id,
        name: `Celulares E8 ${UNIQUE}`,
        slug: `celulares-e8-${UNIQUE}`,
      },
    });
    const plan = await prisma.plan.findFirst({ where: { code: 'FREE' } });
    if (!plan) throw new Error('Falta el plan FREE en la base de test');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    anonymous = request.agent(app.getHttpServer());
    ownerAgent = request.agent(app.getHttpServer());
    adminAgent = request.agent(app.getHttpServer());

    await ownerAgent
      .post('/auth/register')
      .send({ email: OWNER_EMAIL, name: 'Dueño E8', password: PASSWORD })
      .expect(201);
    await ownerAgent
      .post('/auth/login')
      .send({ email: OWNER_EMAIL, password: PASSWORD })
      .expect(200);
    const ownerMe = await ownerAgent.get('/auth/me').expect(200);

    await adminAgent
      .post('/auth/register')
      .send({ email: ADMIN_EMAIL, name: 'Admin E8', password: PASSWORD })
      .expect(201);
    // El registro crea siempre BUSINESS_OWNER: se promueve antes de iniciar sesión.
    await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: { role: 'SUPER_ADMIN', emailVerifiedAt: new Date() },
    });
    await adminAgent
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: PASSWORD })
      .expect(200);

    const business = await prisma.business.create({
      data: {
        name: `Prendería E8 ${UNIQUE}`,
        slug: `prenderia-e8-${UNIQUE}`,
        city: 'MEDELLIN',
        addressLine: 'Calle 50 # 40-20',
        whatsapp: '+573001119988',
        verticalId: vertical.id,
        ownerUserId: ownerMe.body.id as string,
        fingerprint: `prenderia e8 | calle 50 40 20 ${UNIQUE}`,
        memberships: { create: { userId: ownerMe.body.id as string, role: 'OWNER' } },
        subscription: {
          create: {
            planId: plan.id,
            status: 'TRIALING',
            currentPeriodStart: new Date(Date.now() - 86_400_000),
            currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
          },
        },
      },
    });

    const listing = await prisma.listing.create({
      data: {
        businessId: business.id,
        categoryId: category.id,
        title: 'iPhone 13 128 GB',
        description: 'Equipo con caja, cargador y factura original. Sin detalles.',
        condition: 'LIKE_NEW',
        priceAmount: 1_800_000,
        status: 'PUBLISHED',
        slug: `iphone-13-e8-${UNIQUE}`,
        publishedAt: new Date(),
      },
    });
    const draft = await prisma.listing.create({
      data: {
        businessId: business.id,
        categoryId: category.id,
        title: 'Borrador E8',
        description: 'Publicación que todavía no se publica en el catálogo.',
        condition: 'GOOD',
        priceAmount: 150_000,
        status: 'DRAFT',
        slug: `borrador-e8-${UNIQUE}`,
      },
    });

    fixture = {
      businessId: business.id,
      businessSlug: business.slug,
      listingId: listing.id,
      listingSlug: listing.slug,
      draftListingId: draft.id,
      ownerUserId: ownerMe.body.id as string,
      categoryId: category.id,
      verticalId: vertical.id,
    };
  }, 60_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.moderationAction.deleteMany({ where: { businessId: fixture.businessId } });
      await prisma.report.deleteMany({ where: { businessId: fixture.businessId } });
      await prisma.listing.deleteMany({ where: { businessId: fixture.businessId } });
      await prisma.subscription.deleteMany({ where: { businessId: fixture.businessId } });
      await prisma.businessMembership.deleteMany({ where: { businessId: fixture.businessId } });
      await prisma.business.deleteMany({ where: { id: fixture.businessId } });
      await prisma.attributeDefinition.deleteMany({ where: { categoryId: fixture.categoryId } });
      await prisma.category.deleteMany({ where: { id: fixture.categoryId } });
      await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, ADMIN_EMAIL] } } });
      await prisma.$disconnect();
    }
    await app?.close();
  });

  it('1 · registra una denuncia anónima sobre una publicación y queda PENDING', async () => {
    const response = await anonymous.post('/public/reports').send(reportOnListing()).expect(201);
    expect(response.body).toMatchObject({ ok: true });

    const row = await prisma.report.findFirst({
      where: { listingId: fixture.listingId },
      orderBy: { createdAt: 'desc' },
    });
    expect(row).not.toBeNull();
    expect(row?.status).toBe('PENDING');
    expect(row?.reason).toBe('SCAM');
    expect(row?.reporterUserId).toBeNull();
    expect(row?.reporterIpHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('2 · el honeypot responde 201 pero no guarda nada', async () => {
    const before = await prisma.report.count({ where: { businessId: fixture.businessId } });
    await anonymous
      .post('/public/reports')
      .send(reportOnListing({ website: 'https://spam.example', reason: 'STOLEN' }))
      .expect(201);
    const after = await prisma.report.count({ where: { businessId: fixture.businessId } });
    expect(after).toBe(before);
  });

  it('3 · rechaza un motivo que no existe', async () => {
    // El DTO de entrada rechaza el motivo antes de llegar al caso de uso.
    const response = await anonymous
      .post('/public/reports')
      .send(reportOnListing({ reason: 'NO_ME_GUSTA' }))
      .expect(400);
    expect(response.body.statusCode).toBe(400);
  });

  it('4 · «Otro motivo» exige explicación y los detalles cortos no pasan', async () => {
    const withoutDetails = await anonymous
      .post('/public/reports')
      .send(reportOnListing({ reason: 'OTHER', details: '' }))
      .expect(400);
    expect(withoutDetails.body.error).toBe('INVALID_DETAILS');

    const tooShort = await anonymous
      .post('/public/reports')
      .send(reportOnListing({ details: 'malo' }))
      .expect(400);
    expect(tooShort.body.error).toBe('INVALID_DETAILS');
  });

  it('5 · rechaza un correo de contacto inválido', async () => {
    const response = await anonymous
      .post('/public/reports')
      .send(reportOnListing({ reporterEmail: 'no-es-correo' }))
      .expect(400);
    expect(response.body.error).toBe('INVALID_EMAIL');
  });

  it('6 · 404 si la publicación no es visible o no existe', async () => {
    await anonymous
      .post('/public/reports')
      .send(reportOnListing({ listingSlug: 'no-existe' }))
      .expect(404);
    await anonymous
      .post('/public/reports')
      .send(reportOnListing({ listingSlug: `borrador-e8-${UNIQUE}` }))
      .expect(404);
  });

  it('7 · un reporte idéntico dentro de 24 h responde 409', async () => {
    const response = await anonymous.post('/public/reports').send(reportOnListing()).expect(409);
    expect(response.body.error).toBe('DUPLICATE_REPORT');
  });

  it('8 · si hay sesión, guarda el usuario denunciante sin exigirla', async () => {
    await ownerAgent
      .post('/public/reports')
      .send(reportOnListing({ reason: 'INAPPROPRIATE' }))
      .expect(201);

    const row = await prisma.report.findFirst({
      where: { listingId: fixture.listingId, reason: 'INAPPROPRIATE' },
    });
    expect(row?.reporterUserId).toBe(fixture.ownerUserId);
  });

  it('9 · permite denunciar al negocio completo sin publicación', async () => {
    const response = await anonymous
      .post('/public/reports')
      .send({
        businessSlug: fixture.businessSlug,
        reason: 'WRONG_CATEGORY',
        details: 'Publica celulares dentro de la categoría de neveras.',
        website: '',
      })
      .expect(201);
    expect(response.body.ok).toBe(true);

    const row = await prisma.report.findFirst({
      where: { businessId: fixture.businessId, listingId: null, reason: 'WRONG_CATEGORY' },
    });
    expect(row?.status).toBe('PENDING');
  });

  it('10 · limita a cinco reportes por hora y conexión', async () => {
    await anonymous
      .post('/public/reports')
      .send(reportOnListing({ reason: 'STOLEN', listingSlug: fixture.listingSlug }))
      .expect(201);

    const limited = await anonymous
      .post('/public/reports')
      .send(reportOnListing({ reason: 'OTHER', details: 'Texto suficientemente largo.' }))
      .expect(429);
    expect(limited.body.error).toBe('RATE_LIMITED');
  });

  it('11 · la bandeja exige SUPER_ADMIN', async () => {
    await anonymous.get('/admin/reports').expect(401);
    await ownerAgent.get('/admin/reports').expect(403);
    await adminAgent.get('/admin/reports').expect(200);
  });

  it('12 · la bandeja pagina, filtra y busca por negocio', async () => {
    const response = await adminAgent
      .get('/admin/reports')
      .query({ status: 'PENDING', limit: 2, page: 1 })
      .expect(200);

    expect(response.body).toMatchObject({ page: 1, limit: 2 });
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items.length).toBeLessThanOrEqual(2);
    for (const item of response.body.items) {
      expect(item.status).toBe('PENDING');
    }

    const search = await adminAgent
      .get('/admin/reports')
      .query({ q: `Prendería E8 ${UNIQUE}` })
      .expect(200);
    expect(search.body.total).toBeGreaterThan(0);
  });

  it('13 · devuelve el detalle y 404 con un id desconocido', async () => {
    const listed = await adminAgent.get('/admin/reports').query({ limit: 1 }).expect(200);
    const reportId = listed.body.items[0].id as string;

    const detail = await adminAgent.get(`/admin/reports/${reportId}`).expect(200);
    expect(detail.body.id).toBe(reportId);
    expect(detail.body.business.name).toContain('Prendería E8');

    await adminAgent.get('/admin/reports/0193f5d0-0000-7000-8000-000000000000').expect(404);
  });

  it('14 · cambia de estado respetando las transiciones y exige nota al resolver', async () => {
    const listed = await adminAgent
      .get('/admin/reports')
      .query({ status: 'PENDING', limit: 1 })
      .expect(200);
    const reportId = listed.body.items[0].id as string;

    const reviewed = await adminAgent
      .patch(`/admin/reports/${reportId}`)
      .send({ status: 'REVIEWED', note: 'Revisando las fotos del artículo.' })
      .expect(200);
    expect(reviewed.body.status).toBe('REVIEWED');

    const shortNote = await adminAgent
      .patch(`/admin/reports/${reportId}`)
      .send({ status: 'RESOLVED', note: 'ok' })
      .expect(400);
    expect(shortNote.body.statusCode).toBe(400);

    const resolved = await adminAgent
      .patch(`/admin/reports/${reportId}`)
      .send({ status: 'RESOLVED', note: 'Se contacted al negocio y se corrigió.' })
      .expect(200);
    expect(resolved.body.status).toBe('RESOLVED');
    expect(resolved.body.resolutionNote).toBe('Se contacted al negocio y se corrigió.');

    const backwards = await adminAgent
      .patch(`/admin/reports/${reportId}`)
      .send({ status: 'REVIEWED', note: 'Intentando reabrir el caso.' })
      .expect(409);
    expect(backwards.body.error).toBe('INVALID_TRANSITION');

    const actions = await prisma.moderationAction.findMany({ where: { reportId } });
    expect(actions.length).toBeGreaterThanOrEqual(2);
    expect(actions.every((action) => action.kind === 'REPORT_STATUS_CHANGED')).toBe(true);
  });

  it('15 · suspende un negocio con motivo, lo audita y lo saca del catálogo', async () => {
    const response = await adminAgent
      .post(`/admin/businesses/${fixture.businessId}/suspend`)
      .send({ reason: 'Recibimos varias denuncias por estafa sin responder.' })
      .expect(200);
    expect(response.body.ok).toBe(true);

    const business = await prisma.business.findUnique({ where: { id: fixture.businessId } });
    expect(business?.status).toBe('SUSPENDED');

    const action = await prisma.moderationAction.findFirst({
      where: { businessId: fixture.businessId, kind: 'BUSINESS_SUSPENDED' },
    });
    expect(action?.reason).toContain('denuncias');

    await anonymous.get(`/public/businesses/${fixture.businessSlug}`).expect(404);
    await anonymous
      .get(`/public/listings/${fixture.businessSlug}/${fixture.listingSlug}`)
      .expect(404);
  });

  it('16 · archiva una publicación, la audita y es idempotente', async () => {
    const first = await adminAgent
      .post(`/admin/listings/${fixture.listingId}/archive`)
      .send({ reason: 'Artículo con fotos tomadas de otro vendedor.' })
      .expect(200);
    expect(first.body.ok).toBe(true);

    const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
    expect(listing?.status).toBe('ARCHIVED');
    expect(listing?.featured).toBe(false);

    const action = await prisma.moderationAction.findFirst({
      where: { listingId: fixture.listingId, kind: 'LISTING_ARCHIVED' },
    });
    expect(action).not.toBeNull();

    const second = await adminAgent
      .post(`/admin/listings/${fixture.listingId}/archive`)
      .send({ reason: 'Repetimos la acción por error.' })
      .expect(200);
    expect(second.body.ok).toBe(true);

    const actions = await prisma.moderationAction.count({
      where: { listingId: fixture.listingId, kind: 'LISTING_ARCHIVED' },
    });
    expect(actions).toBe(1);
  });

  it('17 · el resumen cuenta pendientes, revisados, resueltas de hoy y suspendidos', async () => {
    const response = await adminAgent.get('/admin/reports/summary').expect(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        pending: expect.any(Number),
        reviewed: expect.any(Number),
        resolvedToday: expect.any(Number),
        suspendedBusinesses: expect.any(Number),
      }),
    );
    expect(response.body.suspendedBusinesses).toBeGreaterThanOrEqual(1);
  });

  it('18 · suspender un negocio inexistente responde 404 y sin motivo responde 400', async () => {
    await adminAgent
      .post('/admin/businesses/0193f5d0-0000-7000-8000-000000000000/suspend')
      .send({ reason: 'No existe este negocio en la plataforma.' })
      .expect(404);

    await adminAgent
      .post(`/admin/businesses/${fixture.businessId}/suspend`)
      .send({ reason: '' })
      .expect(400);
  });
});
