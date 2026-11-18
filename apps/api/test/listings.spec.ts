import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { PrismaPg } from '@prisma/adapter-pg';
import prismaClientPkg from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';

// Mismo interop que `prisma.service.ts`: `@prisma/client` es CommonJS.
const PrismaClient = prismaClientPkg.PrismaClient;

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/marketcentral_test';

const unique = Date.now().toString(36);
const OWNER_EMAIL = `e5-owner-${unique}@marketcentral.test`;
const OTHER_EMAIL = `e5-other-${unique}@marketcentral.test`;
const PASSWORD = 'ClaveSegura1';
const MEDIA_DIR = '.var/media-test';

process.env.MEDIA_LOCAL_DIR = MEDIA_DIR;
process.env.MEDIA_PUBLIC_BASE_URL = 'http://127.0.0.1:3001/media';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

/** PNG mínimo válido para el inspector (firma + IHDR con dimensiones). */
function pngBuffer(width = 640, height = 480): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4, 'ascii');
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8; // bit depth
  ihdr[17] = 6; // RGBA
  ihdr[18] = 0;
  ihdr[19] = 0;
  ihdr[20] = 0;
  ihdr.writeUInt32BE(0, 21); // CRC (no verificado por el inspector)

  return Buffer.concat([signature, ihdr, Buffer.alloc(16)]);
}

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
    '[listings.spec] PostgreSQL no disponible en DATABASE_URL; los casos de integración se omiten.',
  );
}

const describeIntegration = databaseIsAvailable ? describe : describe.skip;

describeIntegration('Listings (E5) · inventario, atributos, cupos e imágenes', () => {
  let app: INestApplication;
  let ownerAgent: ReturnType<typeof request.agent>;
  let otherAgent: ReturnType<typeof request.agent>;
  let verticalId = '';
  let categoryId = '';
  let attributeCategoryId = '';
  let otherCategoryId = '';
  let draftId = '';

  const server = (): ReturnType<typeof request> => request(app.getHttpServer());

  const createListing = async (
    body: Record<string, unknown>,
    agent: ReturnType<typeof request.agent> = ownerAgent,
  ): Promise<Record<string, unknown>> => {
    const response = await agent
      .post('/businesses/me/listings')
      .send({
        categoryId,
        title: 'Celular de prueba',
        description: 'Equipo en buen estado con caja y cargador original.',
        condition: 'GOOD',
        priceAmount: 450_000,
        ...body,
      })
      .expect(201);

    return response.body as Record<string, unknown>;
  };

  /** Sube N imágenes reales (PNG) y devuelve sus ids en orden. */
  const uploadImages = async (
    listingId: string,
    count: number,
    agent: ReturnType<typeof request.agent> = ownerAgent,
  ): Promise<string[]> => {
    const ids: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const response = await agent
        .post(`/businesses/me/listings/${listingId}/images`)
        .attach('file', pngBuffer(200 + index, 150), {
          filename: `foto-${index}.png`,
          contentType: 'image/png',
        })
        .expect(201);
      ids.push((response.body as { id: string }).id);
    }
    return ids;
  };

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

    const category = await prisma.category.create({
      data: { verticalId, name: `Celulares e5 ${unique}`, slug: `celulares-e5-${unique}` },
    });
    categoryId = category.id;

    const attributeCategory = await prisma.category.create({
      data: { verticalId, name: `Consolas e5 ${unique}`, slug: `consolas-e5-${unique}` },
    });
    attributeCategoryId = attributeCategory.id;

    await prisma.attributeDefinition.create({
      data: {
        categoryId: attributeCategory.id,
        name: 'Marca',
        code: 'brand',
        type: 'TEXT',
        isRequired: true,
        isFilterable: true,
      },
    });

    const otherVertical = await prisma.vertical.upsert({
      where: { slug: 'joyerias' },
      update: {},
      create: { name: 'Joyerías', slug: 'joyerias', isActive: true },
    });
    const foreign = await prisma.category.create({
      data: {
        verticalId: otherVertical.id,
        name: `Anillos e5 ${unique}`,
        slug: `anillos-e5-${unique}`,
      },
    });
    otherCategoryId = foreign.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    ownerAgent = request.agent(app.getHttpServer());
    otherAgent = request.agent(app.getHttpServer());

    const register = async (
      agent: ReturnType<typeof request.agent>,
      email: string,
    ): Promise<void> => {
      await agent
        .post('/auth/register')
        .send({ email, password: PASSWORD, name: 'Prueba E5' })
        .expect(201);
      await agent.post('/auth/login').send({ email, password: PASSWORD }).expect(200);
    };

    await register(ownerAgent, OWNER_EMAIL);
    await register(otherAgent, OTHER_EMAIL);

    await ownerAgent
      .post('/businesses')
      .send({
        verticalId,
        name: 'Prendería E5 Principal',
        city: 'MEDELLIN',
        addressLine: 'Carrera 43 # 10-20',
        whatsapp: '3001112233',
      })
      .expect(201);

    await otherAgent
      .post('/businesses')
      .send({
        verticalId,
        name: 'Prendería E5 Vecina',
        city: 'ITAGUI',
        addressLine: 'Calle 20 # 15-40',
        whatsapp: '3004445566',
      })
      .expect(201);
  }, 120_000);

  afterAll(async () => {
    if (databaseIsAvailable) {
      await prisma.business.deleteMany({ where: { owner: { email: { startsWith: 'e5-' } } } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'e5-' } } });
      await prisma.attributeDefinition.deleteMany({
        where: { category: { slug: { contains: `e5-${unique}` } } },
      });
      await prisma.category.deleteMany({ where: { slug: { contains: `e5-${unique}` } } });
    }
    await prisma.$disconnect();
    if (app) await app.close();
  });

  it('crea una publicación en DRAFT con su slug y cupos del plan', async () => {
    const listing = await createListing({ title: 'iPhone 13 128 GB' });
    draftId = listing.id as string;

    expect(listing).toMatchObject({
      title: 'iPhone 13 128 GB',
      status: 'DRAFT',
      priceAmount: 450_000,
      currency: 'COP',
      featured: false,
      attributesSchemaVersion: 1,
    });
    expect(listing.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

    const list = await ownerAgent.get('/businesses/me/listings').expect(200);
    expect(list.body.items[0].id).toBe(draftId);
    expect(list.body.limits).toMatchObject({ maxListings: 10, featuredSlots: 3 });
    expect(list.body.limits.used).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it('acepta precios en dólares y rechaza monedas no soportadas', async () => {
    const inUsd = await createListing({
      title: 'MacBook Air M2 importada',
      currency: 'USD',
      priceAmount: 850,
    });
    expect(inUsd).toMatchObject({ currency: 'USD', priceAmount: 850 });

    const detail = await ownerAgent
      .get(`/businesses/me/listings/${inUsd.id as string}`)
      .expect(200);
    expect(detail.body).toMatchObject({ currency: 'USD', priceAmount: 850 });

    await ownerAgent
      .post('/businesses/me/listings')
      .send({
        categoryId,
        title: 'Artículo con moneda inválida',
        description: 'Descripción suficientemente larga para el validador.',
        condition: 'GOOD',
        priceAmount: 100,
        currency: 'EUR',
      })
      .expect(400);

    await ownerAgent
      .patch(`/businesses/me/listings/${inUsd.id as string}`)
      .send({ currency: 'COP', priceAmount: 3_500_000 })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ currency: 'COP', priceAmount: 3_500_000 }),
      );
  }, 30_000);

  it('rechaza una categoría de otra vertical (400)', async () => {
    await ownerAgent
      .post('/businesses/me/listings')
      .send({
        categoryId: otherCategoryId,
        title: 'Celular ajeno',
        description: 'Descripción suficientemente larga para el validador.',
        condition: 'GOOD',
        priceAmount: 1000,
      })
      .expect(400)
      .expect(({ body }) => expect(body.error).toBe('CATEGORY_NOT_IN_VERTICAL'));
  }, 30_000);

  it('valida los atributos obligatorios de la categoría (400 y luego 201)', async () => {
    await ownerAgent
      .post('/businesses/me/listings')
      .send({
        categoryId: attributeCategoryId,
        title: 'PlayStation 5',
        description: 'Consola con dos controles y todos sus cables.',
        condition: 'LIKE_NEW',
        priceAmount: 2_000_000,
        attributes: {},
      })
      .expect(400)
      .expect(({ body }) => expect(body.error).toBe('INVALID_ATTRIBUTES'));

    const created = await ownerAgent
      .post('/businesses/me/listings')
      .send({
        categoryId: attributeCategoryId,
        title: 'PlayStation 5',
        description: 'Consola con dos controles y todos sus cables.',
        condition: 'LIKE_NEW',
        priceAmount: 2_000_000,
        attributes: { brand: 'Sony' },
      })
      .expect(201);

    expect(created.body.attributes).toEqual({ brand: 'Sony' });

    await prisma.listing.delete({ where: { id: created.body.id as string } });
  }, 30_000);

  it('bloquea publicar con menos de 4 fotos (400 IMAGES_REQUIRED)', async () => {
    await ownerAgent
      .patch(`/businesses/me/listings/${draftId}`)
      .send({ priceAmount: 430_000, condition: 'FAIR' })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ priceAmount: 430_000, condition: 'FAIR' }),
      );

    await ownerAgent
      .post(`/businesses/me/listings/${draftId}/publish`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toBe('IMAGES_REQUIRED');
        expect(body.message).toContain('mínimo 4 fotos');
      });

    const withThreePhotos = await createListing({ title: 'Borrador con tres fotos' });
    await uploadImages(withThreePhotos.id as string, 3);

    await ownerAgent
      .post(`/businesses/me/listings/${withThreePhotos.id as string}/publish`)
      .expect(400)
      .expect(({ body }) => expect(body.error).toBe('IMAGES_REQUIRED'));

    await prisma.listing.deleteMany({ where: { id: withThreePhotos.id as string } });
  }, 60_000);
  it('sube imágenes reales (magic bytes), las reordena y publica con 4', async () => {
    const ids = await uploadImages(draftId as string, 5);

    const image = await ownerAgent.get(`/businesses/me/listings/${draftId}`).expect(200);
    const first = (image.body.images as Array<{ id: string; mimeType: string; width: number }>)[0];
    expect(first?.mimeType).toBe('image/png');
    expect(first?.width).toBeGreaterThan(0);
    expect((image.body.images as Array<{ url: string }>)[0]?.url).toContain('/media/listings/');

    const reordered = await ownerAgent
      .patch(`/businesses/me/listings/${draftId}/images/order`)
      .send({ imageIds: [...ids].reverse() })
      .expect(200);

    expect((reordered.body as Array<{ id: string }>).map((item) => item.id)).toEqual(
      [...ids].reverse(),
    );

    const removed = await ownerAgent
      .delete(`/businesses/me/listings/${draftId}/images/${ids[0]}`)
      .expect(204);
    expect(removed.body).toEqual({});

    const published = await ownerAgent
      .post(`/businesses/me/listings/${draftId}/publish`)
      .expect(200);

    expect(published.body.status).toBe('PUBLISHED');
    expect(published.body.publishedAt).toBeTruthy();
    expect((published.body.images as unknown[]).length).toBe(4);
  }, 60_000);

  it('rechaza archivos que no son imagen y los que superan 5 MB', async () => {
    const other = await createListing({ title: 'Tablet de prueba' });

    await ownerAgent
      .post(`/businesses/me/listings/${other.id as string}/images`)
      .attach('file', Buffer.from('esto no es una imagen'), {
        filename: 'falso.png',
        contentType: 'image/png',
      })
      .expect(400)
      .expect(({ body }) => expect(body.error).toBe('INVALID_IMAGE_TYPE'));

    await ownerAgent
      .post(`/businesses/me/listings/${other.id as string}/images`)
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 10, 1), {
        filename: 'enorme.png',
        contentType: 'image/png',
      })
      .expect(413);

    await prisma.listing.delete({ where: { id: other.id as string } });
  }, 60_000);

  it('no permite más de 6 imágenes por publicación', async () => {
    const listing = await createListing({ title: 'Laptop de prueba' });

    for (let index = 0; index < 6; index += 1) {
      await ownerAgent
        .post(`/businesses/me/listings/${listing.id as string}/images`)
        .attach('file', pngBuffer(100 + index, 100), {
          filename: `${index}.png`,
          contentType: 'image/png',
        })
        .expect(201);
    }

    await ownerAgent
      .post(`/businesses/me/listings/${listing.id as string}/images`)
      .attach('file', pngBuffer(), { filename: 'extra.png', contentType: 'image/png' })
      .expect(409)
      .expect(({ body }) => expect(body.error).toBe('IMAGE_LIMIT_REACHED'));

    await prisma.listing.delete({ where: { id: listing.id as string } });
  }, 60_000);

  it('aplica el cupo de destacados simultáneos (3 en Free)', async () => {
    const created: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const listing = await createListing({ title: `Consola destacada ${index}` });
      created.push(listing.id as string);
    }

    for (let index = 0; index < 3; index += 1) {
      await ownerAgent
        .patch(`/businesses/me/listings/${created[index]}/feature`)
        .send({ featured: true })
        .expect(200)
        .expect(({ body }) => expect(body.featured).toBe(true));
    }

    await ownerAgent
      .patch(`/businesses/me/listings/${created[3]}/feature`)
      .send({ featured: true })
      .expect(409)
      .expect(({ body }) => expect(body.error).toBe('FEATURED_LIMIT_REACHED'));

    // Quitar un destacado libera el cupo.
    await ownerAgent
      .patch(`/businesses/me/listings/${created[0]}/feature`)
      .send({ featured: false })
      .expect(200);
    await ownerAgent
      .patch(`/businesses/me/listings/${created[3]}/feature`)
      .send({ featured: true })
      .expect(200);

    for (const id of created) await prisma.listing.delete({ where: { id } });
  }, 60_000);

  it('vender y archivar son irreversibles y bloquean la edición', async () => {
    const sold = await createListing({ title: 'Nevera usada' });
    const id = sold.id as string;

    await uploadImages(id, 4);
    await ownerAgent.post(`/businesses/me/listings/${id}/publish`).expect(200);

    await ownerAgent.post(`/businesses/me/listings/${id}/sell`).expect(200);
    await ownerAgent
      .patch(`/businesses/me/listings/${id}`)
      .send({ priceAmount: 1000 })
      .expect(409)
      .expect(({ body }) => expect(body.error).toBe('LISTING_LOCKED'));

    await ownerAgent.post(`/businesses/me/listings/${id}/archive`).expect(200);
    await ownerAgent
      .post(`/businesses/me/listings/${id}/publish`)
      .expect(409)
      .expect(({ body }) => expect(body.error).toBe('INVALID_STATUS_TRANSITION'));

    await prisma.listing.delete({ where: { id } });
  }, 30_000);

  it('archivar libera cupo de publicaciones', async () => {
    const used = (await ownerAgent.get('/businesses/me/listings').expect(200)).body.limits
      .used as number;
    const remaining = 10 - used;

    const created: string[] = [];
    for (let index = 0; index < remaining; index += 1) {
      const listing = await createListing({ title: `Relleno ${index}` });
      created.push(listing.id as string);
    }

    await ownerAgent
      .post('/businesses/me/listings')
      .send({
        categoryId,
        title: 'Excedente',
        description: 'Descripción suficientemente larga para el validador.',
        condition: 'GOOD',
        priceAmount: 1000,
      })
      .expect(409)
      .expect(({ body }) => expect(body.error).toBe('LISTING_LIMIT_REACHED'));

    await ownerAgent.post(`/businesses/me/listings/${created[0]}/archive`).expect(200);
    await createListing({ title: 'Después de archivar' });

    for (const id of created) await prisma.listing.deleteMany({ where: { id } });
    await prisma.listing.deleteMany({
      where: { business: { owner: { email: OWNER_EMAIL } }, title: 'Después de archivar' },
    });
  }, 120_000);

  it('aísla el inventario entre negocios (403) y exige sesión (401)', async () => {
    const listing = await createListing({ title: 'Artículo aislado' });
    const id = listing.id as string;

    await otherAgent
      .get(`/businesses/me/listings/${id}`)
      .expect(403)
      .expect(({ body }) => expect(body.error).toBe('LISTING_NOT_OWNED'));

    await otherAgent.patch(`/businesses/me/listings/${id}`).send({ priceAmount: 1 }).expect(403);

    await server().get('/businesses/me/listings').expect(401);
    await server().post(`/businesses/me/listings/${id}/archive`).expect(401);

    await prisma.listing.delete({ where: { id } });
  }, 30_000);

  it('filtra por estado y busca por título', async () => {
    const listing = await createListing({ title: 'Bicicleta GW Rin 29' });
    const archiveResponse = await ownerAgent
      .post(`/businesses/me/listings/${listing.id as string}/archive`)
      .expect(200);
    expect(archiveResponse.body.status).toBe('ARCHIVED');

    const archived = await ownerAgent
      .get('/businesses/me/listings?status=ARCHIVED&search=bicicleta')
      .expect(200);
    expect(archived.body.items.some((item: { id: string }) => item.id === listing.id)).toBe(true);

    const drafts = await ownerAgent.get('/businesses/me/listings?status=DRAFT').expect(200);
    expect(drafts.body.items.every((item: { status: string }) => item.status === 'DRAFT')).toBe(
      true,
    );

    await prisma.listing.delete({ where: { id: listing.id as string } });
  }, 30_000);
});
