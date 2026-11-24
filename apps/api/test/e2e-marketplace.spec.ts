import { createFormToken } from '../src/modules/leads/domain/form-token.js';

process.env.FORM_TOKEN_SECRET = 'test-form-token-secret';
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

const PrismaClientCtor = prismaClientPkg.PrismaClient;

const UNIQUE = Date.now().toString(36);
const OWNER_EMAIL = `e9-owner-${UNIQUE}@marketcentral.test`;
const ADMIN_EMAIL = `e9-admin-${UNIQUE}@marketcentral.test`;
const BUYER_EMAIL = `e9-buyer-${UNIQUE}@example.com`;
const PASSWORD = 'Prueba1234!';
const PHONE = `3${String(Number.parseInt(UNIQUE, 36)).slice(-9).padStart(9, '0')}`;
const PNG = pngBuffer();

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

function pngBuffer(): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4, 'ascii');
  ihdr.writeUInt32BE(320, 8);
  ihdr.writeUInt32BE(320, 12);
  ihdr[16] = 8;
  ihdr[17] = 6;
  return Buffer.concat([signature, ihdr]);
}

const describeIntegration = (await databaseAvailable()) ? describe : describe.skip;

/**
 * Recorrido del comprador de punta a punta, sin atajos de repositorio:
 * el dueño publica, el comprador encuentra y escribe, el dueño lee y el admin
 * ve la plataforma. Solo los datos de referencia (vertical, categoría) se crean
 * por Prisma porque son catálogo global, no parte del flujo.
 */
describeIntegration('E9 · recorrido completo del marketplace (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let ownerAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;

  let verticalId = '';
  let categoryId = '';
  let businessSlug = '';
  let listingId = '';
  let listingSlug = '';
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClientCtor({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    }) as PrismaClient;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    ownerAgent = request.agent(app.getHttpServer());
    adminAgent = request.agent(app.getHttpServer());

    const vertical = await prisma.vertical.upsert({
      where: { slug: 'prenderias' },
      update: {},
      create: { name: 'Prenderías', slug: 'prenderias' },
    });
    verticalId = vertical.id;

    const category = await prisma.category.create({
      data: { verticalId, name: `E9 Categoria ${UNIQUE}`, slug: `e9-cat-${UNIQUE}` },
    });
    categoryId = category.id;
  }, 60_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.lead.deleteMany({ where: { buyerEmail: BUYER_EMAIL } });
      if (businessSlug) {
        await prisma.listingImage.deleteMany({
          where: { listing: { business: { slug: businessSlug } } },
        });
        await prisma.listing.deleteMany({ where: { business: { slug: businessSlug } } });
        await prisma.subscription.deleteMany({ where: { business: { slug: businessSlug } } });
        await prisma.businessMembership.deleteMany({ where: { business: { slug: businessSlug } } });
        await prisma.business.deleteMany({ where: { slug: businessSlug } });
      }
      if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.$disconnect();
    }
    await app?.close();
  }, 60_000);

  it('1 · el dueño se registra, crea su negocio y publica un artículo', async () => {
    const register = await ownerAgent
      .post('/auth/register')
      .send({ name: 'Dueno E9', email: OWNER_EMAIL, password: PASSWORD })
      .expect(201);
    createdUserIds.push(register.body.id);

    await ownerAgent.post('/auth/login').send({ email: OWNER_EMAIL, password: PASSWORD }).expect(200);

    const business = await ownerAgent.post('/businesses').send({
      verticalId,
      name: `Prenderia E9 ${UNIQUE}`,
      city: 'MEDELLIN',
      addressLine: 'Calle 1 # 2-3, centro',
      whatsapp: PHONE,
    });
    if (business.status !== 201) {
      throw new Error(`POST /businesses -> ${business.status}: ${JSON.stringify(business.body)}`);
    }
    businessSlug = business.body.business.slug;
    expect(business.body.subscription.status).toBe('TRIALING');
    expect(business.body.subscription.plan.code).toBe('FREE');

    const listing = await ownerAgent.post('/businesses/me/listings').send({
      categoryId,
      title: 'Bicicleta E9 en buen estado',
      description: 'Bicicleta de montana con cambios, usada pocas veces y lista para rodar.',
      condition: 'GOOD',
      priceAmount: 850_000,
      currency: 'COP',
    });
    if (listing.status !== 201) {
      throw new Error(`POST /listings -> ${listing.status}: ${JSON.stringify(listing.body)}`);
    }
    listingId = listing.body.id;

    await ownerAgent
      .post(`/businesses/me/listings/${listingId}/images`)
      .attach('file', PNG, { filename: 'bici.png', contentType: 'image/png' })
      .expect(201);

    const published = await ownerAgent
      .post(`/businesses/me/listings/${listingId}/publish`)
      .expect(200);
    expect(published.body.status).toBe('PUBLISHED');
    if (published.body.slug) listingSlug = published.body.slug;
    else {
      const mine = await ownerAgent.get('/businesses/me/listings').expect(200);
      const row = mine.body.items.find((item: { id: string }) => item.id === listingId);
      listingSlug = row?.slug ?? '';
    }
    expect(listingSlug).not.toBe('');
  }, 60_000);

  it('2 · el comprador la encuentra en el catálogo público y ve el detalle', async () => {
    const search = await request(app.getHttpServer())
      .get('/public/listings')
      .query({ verticalSlug: 'prenderias', searchText: 'Bicicleta E9' })
      .expect(200);
    const found = search.body.items[0];
    if (!found) throw new Error(`búsqueda vacía: ${JSON.stringify(search.body)}`);
    expect(found.title).toContain('Bicicleta E9');
    expect(found.priceAmount).toBe(850_000);
    expect(found.featured).toBe(false);

    const detail = await request(app.getHttpServer()).get(
      `/public/listings/${businessSlug}/${found.listingSlug}`,
    );
    if (detail.status !== 200)
      throw new Error(`detalle ${detail.status}: ${JSON.stringify(detail.body)} biz=${businessSlug} slug=${found.slug}`);
    expect(detail.body.title).toBe('Bicicleta E9 en buen estado');
    expect(detail.body.business.slug).toBe(businessSlug);
    expect(detail.body.images.length).toBe(1);
    expect(JSON.stringify(detail.body)).not.toContain('passwordHash');
  }, 30_000);

  it('3 · el comprador envía el formulario y queda un lead', async () => {
    await request(app.getHttpServer()).get('/public/leads/form-token').expect(200);
    const token = createFormToken(new Date(Date.now() - 10_000), 'test-form-token-secret');

    const created = await request(app.getHttpServer()).post('/public/leads').send({
      businessSlug,
      buyerName: 'Comprador E9',
      buyerEmail: BUYER_EMAIL,
      buyerPhone: '3009876543',
      message: 'Hola, sigue disponible la bicicleta? Puedo pasar hoy mismo.',
      consent: true,
      website: '',
      formToken: token,
    });
    if (created.status !== 201) {
      throw new Error(`POST /public/leads -> ${created.status}: ${JSON.stringify(created.body)}`);
    }
  }, 30_000);

  it('4 · el dueño ve el contacto, lo abre y lo marca como leído', async () => {
    const inbox = await ownerAgent.get('/businesses/me/leads').expect(200);
    expect(inbox.body.total).toBe(1);
    expect(inbox.body.unreadCount).toBe(1);
    const leadId = inbox.body.items[0].id;

    const detail = await ownerAgent.get(`/businesses/me/leads/${leadId}`).expect(200);
    expect(detail.body.status).toBe('READ');
    expect(detail.body.buyerEmail).toBe(BUYER_EMAIL);

    const summary = await ownerAgent.get('/businesses/me/leads/summary').expect(200);
    expect(summary.body.unreadCount).toBe(0);

    await ownerAgent.patch(`/businesses/me/leads/${leadId}`).send({ status: 'REPLIED' }).expect(200);
  }, 30_000);

  it('5 · el admin ve negocio, suscripción, contactos y salud de la plataforma', async () => {
    const register = await adminAgent
      .post('/auth/register')
      .send({ name: 'Admin E9', email: ADMIN_EMAIL, password: PASSWORD })
      .expect(201);
    createdUserIds.push(register.body.id);
    await prisma.user.update({
      where: { id: register.body.id },
      data: { role: 'SUPER_ADMIN', emailVerifiedAt: new Date() },
    });
    await adminAgent.post('/auth/login').send({ email: ADMIN_EMAIL, password: PASSWORD }).expect(200);

    const businesses = await adminAgent.get('/admin/businesses');
    if (businesses.status !== 200) throw new Error(`admin businesses ${businesses.status}: ${JSON.stringify(businesses.body)}`);
    expect(
      (Array.isArray(businesses.body) ? businesses.body : businesses.body.items).some(
        (item: { slug: string }) => item.slug === businessSlug,
      ),
    ).toBe(
      true,
    );

    const subscriptions = await adminAgent
      .get('/admin/subscriptions')
      .query({ limit: 1 })
      .expect(200);
    expect(subscriptions.body.total).toBeGreaterThan(0);

    const moderation = await adminAgent.get('/admin/reports/summary').expect(200);
    expect(moderation.body).toHaveProperty('pending');

    const taxonomy = await adminAgent.get('/admin/taxonomy/verticals').expect(200);
    const taxonomyRows = Array.isArray(taxonomy.body) ? taxonomy.body : taxonomy.body.items;
    expect(taxonomyRows.length).toBeGreaterThan(0);

    await ownerAgent.get('/admin/businesses').expect(403);
  }, 60_000);
});
