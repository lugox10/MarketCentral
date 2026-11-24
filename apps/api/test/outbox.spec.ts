import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { AppModule } from '../src/app.module.js';
import { OutboxProcessor } from '../src/modules/outbox/application/outbox.processor.js';
import { OutboxService } from '../src/modules/outbox/application/outbox.service.js';
import { createFormToken } from '../src/modules/leads/domain/form-token.js';

process.env.FORM_TOKEN_SECRET = 'test-form-token-secret';
process.env.IP_HASH_SECRET = 'test-ip-hash-secret';
process.env.MEDIA_LOCAL_DIR = '.var/media-test';
process.env.MEDIA_PUBLIC_BASE_URL = 'http://127.0.0.1:3001/media';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/marketcentral_test';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

async function databaseAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

function png(width = 320, height = 320): Buffer {
  const buffer = Buffer.alloc(33);
  buffer.writeUInt32BE(0x89504e47, 0);
  buffer.writeUInt32BE(0x0d0a1a0a, 4);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer[24] = 8;
  buffer[25] = 6;
  return buffer;
}

describeIntegration('E10 · transactional outbox', () => {
  let app: INestApplication;
  let ownerAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;
  let businessId = '';
  let businessSlug = '';
  let listingSlug = '';
  let categoryId = '';
  const suffix = randomUUID().slice(0, 8);
  const startedAt = new Date();
  const ownerEmail = `e10-owner-${suffix}@marketcentral.test`;
  const adminEmail = `e10-admin-${suffix}@marketcentral.test`;

  beforeAll(async () => {
    if (!(await databaseAvailable())) return;

    const vertical = await prisma.vertical.upsert({
      where: { slug: 'prenderias' },
      update: {},
      create: { name: 'Prenderías', slug: 'prenderias' },
      select: { id: true },
    });

    const category = await prisma.category.findFirst({
      where: { verticalId: vertical.id, slug: 'celulares', businessId: null },
      select: { id: true },
    });
    categoryId =
      category?.id ??
      (
        await prisma.category.create({
          data: { verticalId: vertical.id, name: 'Celulares', slug: 'celulares' },
          select: { id: true },
        })
      ).id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    ownerAgent = request.agent(app.getHttpServer());
    adminAgent = request.agent(app.getHttpServer());

    await ownerAgent
      .post('/auth/register')
      .send({ name: 'Dueño E10', email: ownerEmail, password: 'Prueba1234' })
      .expect(201);
    await ownerAgent
      .post('/auth/login')
      .send({ email: ownerEmail, password: 'Prueba1234' })
      .expect(200);

    const created = await ownerAgent
      .post('/businesses')
      .send({
        verticalId: vertical.id,
        name: `E10 Negocio ${suffix}`,
        city: 'MEDELLIN',
        addressLine: 'Calle 10 # 10-10',
        whatsapp: '3001112233',
      })
      .expect(201);

    businessId = created.body.business.id;
    businessSlug = created.body.business.slug;

    const listing = await ownerAgent
      .post('/businesses/me/listings')
      .send({
        categoryId,
        title: 'Celular E10 en buen estado',
        description: 'Equipo de prueba con todos los accesorios y caja original.',
        condition: 'GOOD',
        priceAmount: 900_000,
      })
      .expect(201);

    await ownerAgent
      .post(`/businesses/me/listings/${listing.body.id}/images`)
      .attach('file', png(), { filename: 'foto.png', contentType: 'image/png' })
      .expect(201);

    await ownerAgent.post(`/businesses/me/listings/${listing.body.id}/publish`).expect(200);

    const detail = await ownerAgent.get(`/businesses/me/listings/${listing.body.id}`).expect(200);
    listingSlug = detail.body.slug;

    await adminAgent
      .post('/auth/register')
      .send({ name: 'Admin E10', email: adminEmail, password: 'Prueba1234' })
      .expect(201);
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: 'SUPER_ADMIN' },
    });
    await adminAgent
      .post('/auth/login')
      .send({ email: adminEmail, password: 'Prueba1234' })
      .expect(200);
  }, 60_000);

  afterAll(async () => {
    if (!app) return;

    await prisma.report.deleteMany({ where: { businessId } });
    await prisma.lead.deleteMany({ where: { businessId } });
    await prisma.listingImage.deleteMany({ where: { listing: { businessId } } });
    await prisma.listing.deleteMany({ where: { businessId } });
    await prisma.subscriptionActivation.deleteMany({
      where: { subscription: { businessId } },
    });
    await prisma.subscription.deleteMany({ where: { businessId } });
    await prisma.businessMembership.deleteMany({ where: { businessId } });
    await prisma.business.deleteMany({ where: { id: businessId } });
    await prisma.outboxEvent.deleteMany({ where: { createdAt: { gte: startedAt } } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, adminEmail] } } });

    await app.close();
    await prisma.$disconnect();
  }, 60_000);

  it('registra BusinessRegistered al crear el negocio (en la misma transacción)', async () => {
    const event = await prisma.outboxEvent.findFirst({
      where: { eventType: 'BusinessRegistered', dedupeKey: `BusinessRegistered:${businessId}` },
    });
    expect(event).not.toBeNull();
    expect(event?.status).toBe('PENDING');
    const payload = event?.payload as Record<string, unknown>;
    expect(payload.businessSlug).toBe(businessSlug);
    expect(payload.verticalId).toBeTruthy();
    expect(JSON.stringify(payload)).not.toContain('@');
  }, 30_000);

  it('registra LeadCreated al enviar el formulario, sin datos personales en el payload', async () => {
    const tokenResponse = await request(app.getHttpServer())
      .get('/public/leads/form-token')
      .expect(200);
    const token = tokenResponse.body.token as string;
    // El token del endpoint exige 3 s de espera; se firma uno con antigüedad.
    const oldToken = createFormToken(new Date(Date.now() - 10_000), 'test-form-token-secret');

    expect(token).toMatch(/^v1\./);

    await request(app.getHttpServer())
      .post('/public/leads')
      .send({
        businessSlug,
        listingSlug,
        buyerName: 'Comprador E10',
        buyerEmail: `e10-buyer-${suffix}@example.com`,
        buyerPhone: '3009998877',
        message: 'Hola, ¿sigue disponible? Me interesa el equipo.',
        consent: true,
        website: '',
        formToken: oldToken,
      })
      .expect(201);

    const event = await prisma.outboxEvent.findFirst({
      where: { eventType: 'LeadCreated' },
      orderBy: { createdAt: 'desc' },
    });
    expect(event?.status).toBe('PENDING');
    const payload = event?.payload as Record<string, unknown>;
    expect(payload.businessId).toBe(businessId);
    expect(payload.listingId).toBeTruthy();
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('@');
    expect(serialized).not.toContain('3009998877');
    expect(serialized).not.toContain('Comprador E10');
  }, 30_000);

  it('registra SubscriptionActivated al activar un plan de pago', async () => {
    const plan = await prisma.plan.findFirst({ where: { code: 'BASE' }, select: { id: true } });

    await adminAgent
      .post(`/admin/subscriptions/${businessId}/activate`)
      .send({ planId: plan?.id, note: 'Pago verificado en pruebas E10' })
      .expect(201);

    const event = await prisma.outboxEvent.findFirst({
      where: { eventType: 'SubscriptionActivated' },
      orderBy: { createdAt: 'desc' },
    });
    const payload = event?.payload as Record<string, unknown>;
    expect(payload.businessId).toBe(businessId);
    expect(payload.planCode).toBe('BASE');
    expect(payload.status).toBe('ACTIVE');
  }, 30_000);

  it('registra ReportCreated al denunciar una publicación', async () => {
    await request(app.getHttpServer())
      .post('/public/reports')
      .send({
        listingSlug,
        businessSlug,
        reason: 'WRONG_CATEGORY',
        details: 'La publicación aparece en una categoría que no corresponde.',
      })
      .expect(201);

    const event = await prisma.outboxEvent.findFirst({
      where: { eventType: 'ReportCreated' },
      orderBy: { createdAt: 'desc' },
    });
    const payload = event?.payload as Record<string, unknown>;
    expect(payload.businessId).toBe(businessId);
    expect(payload.reason).toBe('WRONG_CATEGORY');
  }, 30_000);

  it('deduplica por clave: el mismo hecho no se encola dos veces', async () => {
    const outbox = app.get(OutboxService);
    const client = prisma as unknown as Parameters<OutboxService['enqueue']>[0];
    const dedupeId = `dedupe-${suffix}`;
    const first = await outbox.enqueue(client, {
      type: 'ReportCreated',
      dedupeId,
      payload: { reportId: dedupeId },
    });
    const second = await outbox.enqueue(client, {
      type: 'ReportCreated',
      dedupeId,
      payload: { reportId: dedupeId },
    });

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    const count = await prisma.outboxEvent.count({
      where: { dedupeKey: `ReportCreated:${dedupeId}` },
    });
    expect(count).toBe(1);
  }, 30_000);

  it('el procesador marca los pendientes como PROCESSED', async () => {
    const processor = app.get(OutboxProcessor);
    const before = await prisma.outboxEvent.count({ where: { status: 'PENDING' } });
    expect(before).toBeGreaterThan(0);

    const result = await processor.processBatch(100);

    expect(result.processed).toBeGreaterThan(0);
    const processed = await prisma.outboxEvent.count({ where: { status: 'PROCESSED' } });
    expect(processed).toBe(before);
    const pending = await prisma.outboxEvent.findMany({ where: { status: 'PENDING' } });
    expect(pending).toHaveLength(0);
    const withDate = await prisma.outboxEvent.count({
      where: { status: 'PROCESSED', processedAt: { not: null } },
    });
    expect(withDate).toBe(processed);
  }, 30_000);

  it('reintenta con backoff y termina en FAILED tras agotar intentos', async () => {
    const processor = app.get(OutboxProcessor);
    const target = processor as unknown as {
      deliver: (record: unknown) => Promise<void>;
    };
    const original = target.deliver;
    target.deliver = async () => {
      throw new Error('fallo simulado del transporte');
    };

    const created = await prisma.outboxEvent.create({
      data: {
        eventType: 'LeadCreated',
        payload: { leadId: 'retry-test' },
        dedupeKey: `LeadCreated:retry-${suffix}`,
        attempts: 0,
      },
    });

    try {
      const first = await processor.processBatch(50);
      expect(first.retried).toBeGreaterThan(0);

      const retried = await prisma.outboxEvent.findUnique({ where: { id: created.id } });
      expect(retried?.status).toBe('PENDING');
      expect(retried?.attempts).toBe(1);
      expect(retried?.lastError).toContain('fallo simulado');
      expect(retried!.availableAt.getTime()).toBeGreaterThan(Date.now());

      await prisma.outboxEvent.update({
        where: { id: created.id },
        data: { attempts: 8, availableAt: new Date(Date.now() - 1000) },
      });
      const second = await processor.processBatch(50);
      expect(second.failed).toBeGreaterThan(0);

      const failed = await prisma.outboxEvent.findUnique({ where: { id: created.id } });
      expect(failed?.status).toBe('FAILED');
      expect(failed?.attempts).toBe(9);
    } finally {
      target.deliver = original;
      await prisma.outboxEvent.deleteMany({ where: { id: created.id } });
    }
  }, 30_000);
});

function describeIntegration(name: string, factory: () => void): void {
  const describeFn = process.env.SKIP_INTEGRATION === 'true' ? describe.skip : describe;
  describeFn(name, factory);
}
