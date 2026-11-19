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
import { SubmitPublicLeadUseCase } from '../src/modules/leads/application/lead.use-cases.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PrismaClientCtor = prismaClientPkg.PrismaClient;

const FORM_SECRET = 'test-form-token-secret';
const UNIQUE = Date.now().toString(36);
const OWNER_EMAIL = `e7-owner-${UNIQUE}@marketcentral.test`;
const OTHER_EMAIL = `e7-other-${UNIQUE}@marketcentral.test`;
const PASSWORD = 'Prueba1234!';

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
  verticalId: string;
  categoryId: string;
  businessId: string;
  listingId: string;
  listingSlug: string;
  businessSlug: string;
  ownerUserId: string;
  otherBusinessId: string;
  hiddenListingId: string;
}

describeIntegration('E7 · leads (integración)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let ownerAgent: ReturnType<typeof request.agent>;
  let otherAgent: ReturnType<typeof request.agent>;
  let fixture: Fixture;

  const token = (ageMs = 5_000) => createFormToken(new Date(Date.now() - ageMs), FORM_SECRET);

  const validBody = (overrides: Record<string, unknown> = {}) => ({
    businessSlug: fixture.businessSlug,
    listingSlug: fixture.listingSlug,
    buyerName: 'Ana Compradora',
    buyerEmail: `ana-${UNIQUE}@example.com`,
    buyerPhone: '3001234567',
    message: 'Hola, me interesa este artículo. ¿Sigue disponible?',
    consent: true,
    website: '',
    formToken: token(),
    ...overrides,
  });

  beforeAll(async () => {
    prisma = new PrismaClientCtor({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    }) as PrismaClient;

    await prisma.lead.deleteMany({ where: { buyerEmail: { contains: UNIQUE } } });

    const vertical = await prisma.vertical.upsert({
      where: { slug: 'prenderias' },
      update: {},
      create: { name: 'Prenderías', slug: 'prenderias' },
    });

    const category = await prisma.category.create({
      data: {
        verticalId: vertical.id,
        name: `Celulares ${UNIQUE}`,
        slug: `celulares-e7-${UNIQUE}`,
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

    ownerAgent = request.agent(app.getHttpServer());
    otherAgent = request.agent(app.getHttpServer());
    await ownerAgent
      .post('/auth/register')
      .send({ email: OWNER_EMAIL, name: 'Dueño E7', password: PASSWORD })
      .expect(201);
    await otherAgent
      .post('/auth/register')
      .send({ email: OTHER_EMAIL, name: 'Otro E7', password: PASSWORD })
      .expect(201);
    await ownerAgent
      .post('/auth/login')
      .send({ email: OWNER_EMAIL, password: PASSWORD })
      .expect(200);
    await otherAgent
      .post('/auth/login')
      .send({ email: OTHER_EMAIL, password: PASSWORD })
      .expect(200);

    const ownerMe = await ownerAgent.get('/auth/me').expect(200);
    const otherMe = await otherAgent.get('/auth/me').expect(200);
    const ownerUserId = ownerMe.body.id as string;
    const otherUserId = otherMe.body.id as string;

    const business = await prisma.business.create({
      data: {
        name: `Prendería E7 ${UNIQUE}`,
        slug: `prenderia-e7-${UNIQUE}`,
        city: 'MEDELLIN',
        addressLine: 'Calle 10 # 20-30',
        whatsapp: '+573001112233',
        verticalId: vertical.id,
        ownerUserId,
        fingerprint: `prenderia e7 | calle 10 20 30 ${UNIQUE}`,
        memberships: { create: { userId: ownerUserId, role: 'OWNER' } },
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
    const otherBusiness = await prisma.business.create({
      data: {
        name: `Prendería E7 otra ${UNIQUE}`,
        slug: `prenderia-e7-otra-${UNIQUE}`,
        city: 'BELLO',
        addressLine: 'Carrera 50 # 30-10',
        whatsapp: '+573004445566',
        verticalId: vertical.id,
        ownerUserId: otherUserId,
        fingerprint: `prenderia e7 otra | carrera 50 30 10 ${UNIQUE}`,
        memberships: { create: { userId: otherUserId, role: 'OWNER' } },
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
        title: 'iPhone 15 128 GB',
        description: 'Equipo en excelente estado con caja y cargador original.',
        condition: 'LIKE_NEW',
        priceAmount: 2_500_000,
        status: 'PUBLISHED',
        slug: `iphone-15-e7-${UNIQUE}`,
        publishedAt: new Date(),
      },
    });
    const hidden = await prisma.listing.create({
      data: {
        businessId: business.id,
        categoryId: category.id,
        title: 'Borrador E7',
        description: 'Publicación que todavía no se publica.',
        condition: 'GOOD',
        priceAmount: 100_000,
        status: 'DRAFT',
        slug: `borrador-e7-${UNIQUE}`,
      },
    });

    fixture = {
      verticalId: vertical.id,
      categoryId: category.id,
      businessId: business.id,
      listingId: listing.id,
      listingSlug: listing.slug,
      businessSlug: business.slug,
      ownerUserId,
      otherBusinessId: otherBusiness.id,
      hiddenListingId: hidden.id,
    };
  });

  afterAll(async () => {
    await prisma.lead.deleteMany({ where: { buyerEmail: { contains: UNIQUE } } });
    await prisma.lead.deleteMany({ where: { businessId: fixture.businessId } });
    await prisma.lead.deleteMany({ where: { businessId: fixture.otherBusinessId } });
    await prisma.listingImage.deleteMany({
      where: { listing: { businessId: { in: [fixture.businessId, fixture.otherBusinessId] } } },
    });
    await prisma.listing.deleteMany({
      where: { businessId: { in: [fixture.businessId, fixture.otherBusinessId] } },
    });
    await prisma.subscription.deleteMany({
      where: { businessId: { in: [fixture.businessId, fixture.otherBusinessId] } },
    });
    await prisma.businessMembership.deleteMany({
      where: { businessId: { in: [fixture.businessId, fixture.otherBusinessId] } },
    });
    await prisma.business.deleteMany({
      where: { id: { in: [fixture.businessId, fixture.otherBusinessId] } },
    });
    await prisma.category.deleteMany({ where: { id: fixture.categoryId } });
    await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, OTHER_EMAIL] } } });
    await app.close();
    await prisma.$disconnect();
  });

  it('1 · entrega un token de formulario', async () => {
    const response = await request(app.getHttpServer()).get('/public/leads/form-token').expect(200);
    expect(typeof response.body.token).toBe('string');
    expect(response.body.minSeconds).toBe(3);
  });

  it('2 · guarda un lead válido en estado NEW con consentimiento y retención de 12 meses', async () => {
    const body = validBody({ buyerEmail: `lead-${UNIQUE}-1@example.com` });
    const response = await request(app.getHttpServer())
      .post('/public/leads')
      .send(body)
      .expect(201);
    expect(response.body.ok).toBe(true);

    const lead = await prisma.lead.findFirst({ where: { buyerEmail: body.buyerEmail } });
    expect(lead).not.toBeNull();
    expect(lead?.status).toBe('NEW');
    expect(lead?.source).toBe('LISTING');
    expect(lead?.buyerPhone).toBe('+573001234567');
    expect(lead?.ipHash).toMatch(/^[0-9a-f]{64}$/);

    const expected = new Date(lead!.createdAt);
    expected.setUTCMonth(expected.getUTCMonth() + 12);
    expect(lead!.expiresAt.toISOString().slice(0, 10)).toBe(expected.toISOString().slice(0, 10));
  });

  it('3 · exige consentimiento explícito', async () => {
    await request(app.getHttpServer())
      .post('/public/leads')
      .send(validBody({ consent: false, buyerEmail: `lead-${UNIQUE}-c@example.com` }))
      .expect(400);
  });

  it('4 · rechaza publicación que no es visible', async () => {
    await request(app.getHttpServer())
      .post('/public/leads')
      .send(
        validBody({
          listingSlug: `no-existe-${UNIQUE}`,
          buyerEmail: `lead-${UNIQUE}-x@example.com`,
        }),
      )
      .expect(404);
  });

  it('5 · rechaza un borrador aunque la URL sea directa', async () => {
    const hidden = await prisma.listing.findUnique({ where: { id: fixture.hiddenListingId } });
    await request(app.getHttpServer())
      .post('/public/leads')
      .send(validBody({ listingSlug: hidden!.slug, buyerEmail: `lead-${UNIQUE}-h@example.com` }))
      .expect(404);
  });

  it('6 · rechaza un token alterado', async () => {
    const body = validBody({
      buyerEmail: `lead-${UNIQUE}-t@example.com`,
      formToken: `${token()}x`,
    });
    await request(app.getHttpServer()).post('/public/leads').send(body).expect(400);
  });

  it('7 · rechaza un formulario enviado demasiado rápido', async () => {
    const body = validBody({
      buyerEmail: `lead-${UNIQUE}-f@example.com`,
      formToken: token(500),
    });
    await request(app.getHttpServer()).post('/public/leads').send(body).expect(400);
  });

  it('8 · el honeypot responde igual pero no guarda nada', async () => {
    const body = validBody({
      buyerEmail: `lead-${UNIQUE}-bot@example.com`,
      website: 'https://spam.example',
    });
    await request(app.getHttpServer()).post('/public/leads').send(body).expect(201);
    const stored = await prisma.lead.count({ where: { buyerEmail: body.buyerEmail } });
    expect(stored).toBe(0);
  });

  it('9 · rechaza teléfono inválido', async () => {
    await request(app.getHttpServer())
      .post('/public/leads')
      .send(validBody({ buyerEmail: `lead-${UNIQUE}-p@example.com`, buyerPhone: 'abc' }))
      .expect(400);
  });

  it('10 · no permite dos leads del mismo correo en 24 h', async () => {
    const email = `lead-${UNIQUE}-dup@example.com`;
    await request(app.getHttpServer())
      .post('/public/leads')
      .send(validBody({ buyerEmail: email }))
      .expect(201);
    const again = await request(app.getHttpServer())
      .post('/public/leads')
      .send(validBody({ buyerEmail: email }))
      .expect(409);
    expect(again.body.error).toBe('DUPLICATE_LEAD');
  });

  it('11 · permite volver a escribir cuando el anterior supera las 24 h', async () => {
    const email = `lead-${UNIQUE}-old@example.com`;
    await request(app.getHttpServer())
      .post('/public/leads')
      .send(validBody({ buyerEmail: email }))
      .expect(201);

    await prisma.lead.updateMany({
      where: { buyerEmail: email },
      data: { createdAt: new Date(Date.now() - 25 * 3_600_000) },
    });

    await request(app.getHttpServer())
      .post('/public/leads')
      .send(validBody({ buyerEmail: email }))
      .expect(201);
  });

  it('12 · dos envíos simultáneos no crean duplicados', async () => {
    const email = `lead-${UNIQUE}-race@example.com`;
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/public/leads')
        .send(validBody({ buyerEmail: email })),
      request(app.getHttpServer())
        .post('/public/leads')
        .send(validBody({ buyerEmail: email })),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(await prisma.lead.count({ where: { buyerEmail: email } })).toBe(1);
  });

  it('13 · la bandeja exige sesión', async () => {
    await request(app.getHttpServer()).get('/businesses/me/leads').expect(401);
  });

  it('14 · lista los leads del negocio con contador de no leídos', async () => {
    const response = await ownerAgent.get('/businesses/me/leads').expect(200);
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.unreadCount).toBeGreaterThan(0);
    expect(response.body.total).toBeGreaterThan(0);
  });

  it('15 · abrir el detalle marca READ y es idempotente', async () => {
    const list = await ownerAgent.get('/businesses/me/leads?status=NEW').expect(200);
    const lead = list.body.items[0];

    const first = await ownerAgent.get(`/businesses/me/leads/${lead.id}`).expect(200);
    expect(first.body.status).toBe('READ');

    const second = await ownerAgent.get(`/businesses/me/leads/${lead.id}`).expect(200);
    expect(second.body.status).toBe('READ');
  });

  it('16 · otro negocio no puede ver ni modificar el lead', async () => {
    const list = await ownerAgent.get('/businesses/me/leads').expect(200);
    const lead = list.body.items[0];

    await otherAgent.get(`/businesses/me/leads/${lead.id}`).expect(404);
    await otherAgent
      .patch(`/businesses/me/leads/${lead.id}`)
      .send({ status: 'REPLIED' })
      .expect(404);
  });

  it('17 · cambia el estado a REPLIED y rechaza volver a NEW', async () => {
    const list = await ownerAgent.get('/businesses/me/leads').expect(200);
    const lead = list.body.items[0];

    const updated = await ownerAgent
      .patch(`/businesses/me/leads/${lead.id}`)
      .send({ status: 'REPLIED' })
      .expect(200);
    expect(updated.body.status).toBe('REPLIED');

    await ownerAgent.patch(`/businesses/me/leads/${lead.id}`).send({ status: 'NEW' }).expect(400);
  });

  it('18 · un fallo de correo no revierte el lead', async () => {
    const catalog = {
      findContactTarget: async () => ({
        businessId: 'business-1',
        businessName: 'Prendería',
        businessSlug: 'prenderia',
        listingId: 'listing-1',
        listingTitle: 'iPhone',
        listingSlug: 'iphone',
      }),
    };
    const stored: unknown[] = [];
    const leads = {
      findRecipient: async () => ({
        email: 'owner@example.com',
        name: 'Dueño',
        businessName: 'Prendería',
      }),
      createUnlessDuplicate: async (input: unknown) => {
        const lead = {
          ...(input as Record<string, unknown>),
          id: 'lead-1',
          listingTitle: 'iPhone',
          status: 'NEW',
        };
        stored.push(lead);
        return { created: true, lead };
      },
    };
    const limiter = { consume: async () => ({ allowed: true, retryAfterSeconds: 0 }) };
    const failingMail = {
      sendNewLeadEmail: async () => {
        throw new Error('smtp caído');
      },
    };

    const useCase = new SubmitPublicLeadUseCase(
      catalog as never,
      leads as never,
      limiter as never,
      failingMail as never,
      'test-ip-secret',
      FORM_SECRET,
    );

    const result = await useCase.execute({
      businessSlug: 'prenderia',
      listingSlug: 'iphone',
      buyerName: 'Ana',
      buyerEmail: 'ana@example.com',
      buyerPhone: '3001234567',
      message: 'Mensaje suficientemente largo',
      consent: true,
      formToken: token(),
      ip: '127.0.0.1',
    });

    expect(result.ok).toBe(true);
    expect(stored).toHaveLength(1);
  });

  it('20 · valida nombre, correo y mensaje antes de guardar', async () => {
    await request(app.getHttpServer())
      .post('/public/leads')
      .send(validBody({ buyerName: 'A', buyerEmail: `lead-${UNIQUE}-n@example.com` }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/public/leads')
      .send(validBody({ buyerEmail: 'no-es-correo' }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/public/leads')
      .send(validBody({ buyerEmail: `lead-${UNIQUE}-m@example.com`, message: 'corto' }))
      .expect(400);
  });

  it('21 · registra el origen BUSINESS_PROFILE cuando no hay publicación', async () => {
    const other = await prisma.business.findUniqueOrThrow({
      where: { id: fixture.otherBusinessId },
      select: { slug: true },
    });
    const body = validBody({
      businessSlug: other.slug,
      listingSlug: undefined,
      buyerEmail: `lead-${UNIQUE}-perfil@example.com`,
    });
    await request(app.getHttpServer()).post('/public/leads').send(body).expect(201);
    const lead = await prisma.lead.findFirst({
      where: { buyerEmail: `lead-${UNIQUE}-perfil@example.com` },
    });
    expect(lead?.source).toBe('BUSINESS_PROFILE');
    expect(lead?.listingId).toBeNull();
  });

  it('22 · un negocio inexistente responde 404 sin revelar detalles', async () => {
    await request(app.getHttpServer())
      .post('/public/leads')
      .send(validBody({ businessSlug: 'no-existe-este-negocio', listingSlug: undefined }))
      .expect(404);
  });

  it('23 · rechaza un token caducado', async () => {
    const expired = createFormToken(new Date(Date.now() - 3 * 60 * 60 * 1000), FORM_SECRET);
    const response = await request(app.getHttpServer())
      .post('/public/leads')
      .send(validBody({ formToken: expired }))
      .expect(400);
    expect(response.body.error).toBe('FORM_TOKEN_EXPIRED');
  });

  it('24 · exige el token del formulario', async () => {
    await request(app.getHttpServer())
      .post('/public/leads')
      .send(validBody({ formToken: '' }))
      .expect(400);
  });

  it('25 · el resumen cuenta nuevos y totales del negocio', async () => {
    const response = await ownerAgent.get('/businesses/me/leads/summary').expect(200);
    expect(response.body.total).toBeGreaterThan(0);
    expect(typeof response.body.unreadCount).toBe('number');
  });

  it('26 · filtra por estado y busca por nombre o correo', async () => {
    const filtered = await ownerAgent
      .get('/businesses/me/leads')
      .query({ status: 'NEW', limit: 5 })
      .expect(200);
    expect(filtered.body.items.every((item: { status: string }) => item.status === 'NEW')).toBe(
      true,
    );
    expect(filtered.body.limit).toBe(5);

    const searched = await ownerAgent
      .get('/businesses/me/leads')
      .query({ search: 'Ana Compradora' })
      .expect(200);
    expect(searched.body.items.length).toBeGreaterThan(0);
  });

  it('27 · la respuesta y el detalle no exponen el hash de IP ni identificadores internos', async () => {
    const list = await ownerAgent.get('/businesses/me/leads').expect(200);
    const first = list.body.items[0] as Record<string, unknown>;
    expect(first).not.toHaveProperty('ipHash');
    expect(first).not.toHaveProperty('userAgentHash');
    expect(JSON.stringify(list.body)).not.toContain('ipHash');

    const detail = await ownerAgent.get(`/businesses/me/leads/${String(first.id)}`).expect(200);
    expect(detail.body).not.toHaveProperty('ipHash');
    expect(JSON.stringify(detail.body)).not.toMatch(/[0-9a-f]{64}/);
  });

  it('19 · aplica rate limit por IP y por negocio con 429', async () => {
    let limited = false;
    for (let index = 0; index < 40 && !limited; index += 1) {
      const response = await request(app.getHttpServer())
        .post('/public/leads')
        .send(validBody({ buyerEmail: `lead-${UNIQUE}-rl-${index}@example.com` }));
      if (response.status === 429) limited = true;
    }
    expect(limited).toBe(true);
  });
});
