import type { ExecutionContext } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import prismaClientPkg from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { PublicRateLimitGuard } from '../src/modules/public-catalog/infrastructure/public-rate-limit.guard.js';

const PrismaClient = prismaClientPkg.PrismaClient;

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/marketcentral_test';

process.env.MEDIA_LOCAL_DIR = '.var/media-test';
process.env.MEDIA_PUBLIC_BASE_URL = 'http://127.0.0.1:3001/media';

const unique = Date.now().toString(36);
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
    '[public-catalog.spec] PostgreSQL no disponible en DATABASE_URL; los casos de integración se omiten.',
  );
}

const describeIntegration = databaseIsAvailable ? describe : describe.skip;

describeIntegration('Public catalog (E6) · visibilidad, filtros y detalle', () => {
  let app: INestApplication;
  let verticalId = '';
  let otherVerticalId = '';
  let categoryId = '';
  let categorySlug = '';
  let otherVerticalCategoryId = '';
  let visibleBusinessId = '';
  let secondBusinessId = '';
  let hiddenBusinessId = '';
  let expiredBusinessId = '';

  const server = (): ReturnType<typeof request> => request(app.getHttpServer());

  const business = (overrides: Record<string, unknown>) => ({
    status: 'APPROVED' as const,
    city: 'MEDELLIN' as const,
    addressLine: 'Calle 10 # 43-12',
    whatsapp: '+573001112233',
    fingerprint: `e6-fp-${unique}`,
    ...overrides,
  });

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
          currency: 'COP',
          isActive: true,
        },
        create: { ...plan, currency: 'COP', isActive: true },
      });
    }

    const vertical = await prisma.vertical.upsert({
      where: { slug: 'prenderias' },
      update: { isActive: true },
      create: { name: 'Prenderías', slug: 'prenderias', isActive: true },
    });
    verticalId = vertical.id;

    const otherVertical = await prisma.vertical.upsert({
      where: { slug: `e6-vertical-${unique}` },
      update: {},
      create: { name: `E6 vertical ${unique}`, slug: `e6-vertical-${unique}`, isActive: true },
    });
    otherVerticalId = otherVertical.id;

    const category = await prisma.category.create({
      data: {
        verticalId,
        name: `E6 categoría ${unique}`,
        slug: `e6-cat-${unique}`,
        isActive: true,
      },
    });
    categoryId = category.id;
    categorySlug = category.slug;

    const otherCategory = await prisma.category.create({
      data: {
        verticalId: otherVerticalId,
        name: `E6 otra ${unique}`,
        slug: `e6-otra-${unique}`,
        isActive: true,
      },
    });
    otherVerticalCategoryId = otherCategory.id;

    await prisma.attributeDefinition.create({
      data: { categoryId, name: 'Marca E6', code: 'marca-e6', type: 'TEXT', isRequired: false },
    });

    const freePlan = await prisma.plan.findUniqueOrThrow({ where: { code: 'FREE' } });
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const pastStart = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const pastEnd = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    const ownerFor = (suffix: string) =>
      prisma.user.create({
        data: {
          email: `e6-owner-${suffix}-${unique}@marketcentral.test`,
          passwordHash: 'x',
          name: `Owner E6 ${suffix}`,
          role: 'BUSINESS_OWNER',
          status: 'ACTIVE',
        },
      });

    const owner = await ownerFor('a');

    const visible = await prisma.business.create({
      data: {
        ...business({ whatsapp: '+573001110001', fingerprint: `e6-a-${unique}` }),
        name: `E6 Visible ${unique}`,
        slug: `e6-visible-${unique}`,
        verticalId,
        ownerUserId: owner.id,
        subscription: {
          create: {
            planId: freePlan.id,
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            currentPeriodEnd: future,
          },
        },
      },
    });
    visibleBusinessId = visible.id;

    const second = await prisma.business.create({
      data: {
        ...business({ whatsapp: '+573001110002', city: 'BELLO', fingerprint: `e6-b-${unique}` }),
        name: `E6 Segundo ${unique}`,
        slug: `e6-segundo-${unique}`,
        verticalId,
        ownerUserId: (await ownerFor('b')).id,
        subscription: {
          create: {
            planId: freePlan.id,
            status: 'TRIALING',
            currentPeriodStart: new Date(),
            currentPeriodEnd: future,
          },
        },
      },
    });
    secondBusinessId = second.id;

    const suspended = await prisma.business.create({
      data: {
        ...business({
          status: 'SUSPENDED',
          whatsapp: '+573001110003',
          fingerprint: `e6-c-${unique}`,
        }),
        name: `E6 Suspendido ${unique}`,
        slug: `e6-suspendido-${unique}`,
        verticalId,
        ownerUserId: (await ownerFor('c')).id,
        subscription: {
          create: {
            planId: freePlan.id,
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            currentPeriodEnd: future,
          },
        },
      },
    });
    hiddenBusinessId = suspended.id;

    const expired = await prisma.business.create({
      data: {
        ...business({ whatsapp: '+573001110004', fingerprint: `e6-d-${unique}` }),
        name: `E6 Vencido ${unique}`,
        slug: `e6-vencido-${unique}`,
        verticalId,
        ownerUserId: (await ownerFor('d')).id,
        subscription: {
          create: {
            planId: freePlan.id,
            status: 'ACTIVE',
            currentPeriodStart: pastStart,
            currentPeriodEnd: pastEnd,
          },
        },
      },
    });
    expiredBusinessId = expired.id;

    const listing = (overrides: Record<string, unknown>) => ({
      businessId: visibleBusinessId,
      categoryId,
      title: `Artículo E6 ${unique}`,
      description: 'Descripción suficientemente larga para pasar la validación del dominio.',
      condition: 'GOOD' as const,
      priceAmount: 500_000,
      currency: 'COP',
      status: 'PUBLISHED' as const,
      slug: `e6-listing-${unique}-${Math.random().toString(36).slice(2, 8)}`,
      attributes: {},
      attributesSchemaVersion: 1,
      publishedAt: new Date(),
      ...overrides,
    });

    const published = await prisma.listing.create({
      data: listing({
        slug: `e6-visible-${unique}`,
        title: `iPhone E6 ${unique}`,
        priceAmount: 900_000,
        featured: true,
        attributes: { 'marca-e6': 'Apple' },
      }),
    });

    await prisma.listingImage.create({
      data: {
        listingId: published.id,
        storageKey: `listings/${visibleBusinessId}/${published.id}/foto.png`,
        mimeType: 'image/png',
        sizeBytes: 1024,
        width: 640,
        height: 480,
        position: 0,
      },
    });

    await prisma.listing.create({
      data: listing({
        businessId: secondBusinessId,
        slug: `e6-segundo-${unique}`,
        title: `Samsung E6 ${unique}`,
        priceAmount: 300_000,
        condition: 'LIKE_NEW',
        attributes: {},
      }),
    });

    await prisma.listing.create({
      data: listing({
        slug: `e6-draft-${unique}`,
        status: 'DRAFT',
        publishedAt: null,
        title: `Borrador E6 ${unique}`,
      }),
    });
    await prisma.listing.create({
      data: listing({ slug: `e6-sold-${unique}`, status: 'SOLD', title: `Vendido E6 ${unique}` }),
    });
    await prisma.listing.create({
      data: listing({
        slug: `e6-arch-${unique}`,
        status: 'ARCHIVED',
        title: `Archivado E6 ${unique}`,
      }),
    });
    await prisma.listing.create({
      data: listing({
        businessId: hiddenBusinessId,
        slug: `e6-susp-${unique}`,
        title: `Suspendido E6 ${unique}`,
      }),
    });
    await prisma.listing.create({
      data: listing({
        businessId: expiredBusinessId,
        slug: `e6-exp-${unique}`,
        title: `Vencido E6 ${unique}`,
      }),
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use((await import('cookie-parser')).default());
    app.useGlobalPipes(
      new (await import('@nestjs/common')).ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    const businessIds = [
      visibleBusinessId,
      secondBusinessId,
      hiddenBusinessId,
      expiredBusinessId,
    ].filter(Boolean);
    if (businessIds.length > 0) {
      await prisma.listing.deleteMany({ where: { businessId: { in: businessIds } } });
      await prisma.subscription.deleteMany({ where: { businessId: { in: businessIds } } });
      await prisma.business.deleteMany({ where: { id: { in: businessIds } } });
    }
    await prisma.attributeDefinition.deleteMany({ where: { categoryId } });
    await prisma.category.deleteMany({
      where: { id: { in: [categoryId, otherVerticalCategoryId] } },
    });
    await prisma.vertical.deleteMany({ where: { id: otherVerticalId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e6-owner-' } } });
    if (app) await app.close();
    await prisma.$disconnect();
  });

  it('1 · lista verticales activas con el conteo de publicaciones visibles', async () => {
    const response = await server().get('/public/verticals').expect(200);
    const vertical = (response.body as Array<{ slug: string; listingCount: number }>).find(
      (item) => item.slug === 'prenderias',
    );

    expect(vertical).toBeDefined();
    expect(vertical?.listingCount).toBe(2);
  });

  it('1b · lista las categorías globales activas de una vertical', async () => {
    const response = await server().get('/public/verticals/prenderias/categories').expect(200);

    const categories = response.body as Array<{
      id: string;
      name: string;
      slug: string;
      parentId: string | null;
    }>;
    const own = categories.find((category) => category.slug === categorySlug);
    expect(own).toBeDefined();
    expect(own?.name).toBe(`E6 categoría ${unique}`);
    expect(own?.parentId).toBeNull();
    expect(categories.some((category) => category.slug.startsWith('e6-otra-'))).toBe(false);
  });

  it('1c · las categorías de una vertical inexistente responden 404', async () => {
    const response = await server().get('/public/verticals/no-existe-e6/categories').expect(404);
    expect((response.body as { error: string }).error).toBe('PUBLIC_VERTICAL_NOT_FOUND');
  });

  it('2 · el catálogo agregado solo devuelve publicaciones visibles de varios negocios', async () => {
    const response = await server()
      .get(`/public/listings?verticalSlug=prenderias&searchText=${unique}`)
      .expect(200);

    const body = response.body as {
      items: Array<{ businessSlug: string; listingSlug: string }>;
      total: number;
    };
    expect(body.total).toBe(2);
    expect(new Set(body.items.map((item) => item.businessSlug)).size).toBe(2);
    expect(body.items.map((item) => item.listingSlug)).not.toContain(`e6-draft-${unique}`);
    expect(body.items.map((item) => item.listingSlug)).not.toContain(`e6-sold-${unique}`);
    expect(body.items.map((item) => item.listingSlug)).not.toContain(`e6-arch-${unique}`);
    expect(body.items.map((item) => item.listingSlug)).not.toContain(`e6-susp-${unique}`);
    expect(body.items.map((item) => item.listingSlug)).not.toContain(`e6-exp-${unique}`);
  });

  it('3 · las publicaciones destacadas se ordenan primero', async () => {
    const response = await server()
      .get(`/public/listings?verticalSlug=prenderias&searchText=${unique}`)
      .expect(200);

    const items = (response.body as { items: Array<{ featured: boolean }> }).items;
    expect(items[0]!.featured).toBe(true);
  });

  it('4 · filtra por ciudad', async () => {
    const response = await server()
      .get(`/public/listings?verticalSlug=prenderias&city=BELLO&searchText=${unique}`)
      .expect(200);

    const body = response.body as { items: Array<{ city: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.items[0]!.city).toBe('BELLO');
  });

  it('5 · filtra por rango de precio y condición', async () => {
    const response = await server()
      .get(
        `/public/listings?verticalSlug=prenderias&minPrice=600000&maxPrice=1000000&searchText=${unique}`,
      )
      .expect(200);
    expect((response.body as { total: number }).total).toBe(1);

    const byCondition = await server()
      .get(`/public/listings?verticalSlug=prenderias&condition=LIKE_NEW&searchText=${unique}`)
      .expect(200);
    const items = (byCondition.body as { items: Array<{ condition: string }> }).items;
    expect(items.every((item) => item.condition === 'LIKE_NEW')).toBe(true);
  });

  it('5b · el rango de precio se aplica dentro de la moneda del filtro', async () => {
    // Todas las publicaciones del fixture están en COP: en USD no debe aparecer ninguna.
    const inUsd = await server()
      .get(`/public/listings?verticalSlug=prenderias&currency=USD&searchText=${unique}`)
      .expect(200);
    expect((inUsd.body as { total: number }).total).toBe(0);

    const rangeUsd = await server()
      .get(
        `/public/listings?verticalSlug=prenderias&currency=USD&minPrice=1&maxPrice=1000000000&searchText=${unique}`,
      )
      .expect(200);
    expect((rangeUsd.body as { total: number }).total).toBe(0);

    const inCop = await server()
      .get(`/public/listings?verticalSlug=prenderias&currency=COP&searchText=${unique}`)
      .expect(200);
    expect((inCop.body as { total: number }).total).toBe(2);

    await server().get('/public/listings?currency=EUR').expect(400);
  });

  it('6 · busca por título sin distinguir mayúsculas', async () => {
    const response = await server()
      .get(`/public/listings?verticalSlug=prenderias&searchText=iphone%20e6`)
      .expect(200);

    const items = (response.body as { items: Array<{ title: string }> }).items;
    expect(items.some((item) => item.title.includes('iPhone E6'))).toBe(true);
  });

  it('7 · pagina los resultados', async () => {
    const response = await server()
      .get(`/public/listings?verticalSlug=prenderias&searchText=${unique}&limit=1&page=2`)
      .expect(200);

    const body = response.body as {
      items: unknown[];
      page: number;
      limit: number;
      totalPages: number;
    };
    expect(body.items).toHaveLength(1);
    expect(body.page).toBe(2);
    expect(body.limit).toBe(1);
    expect(body.totalPages).toBe(2);
  });

  it('8 · el detalle devuelve atributos, imágenes y datos del negocio', async () => {
    const response = await server()
      .get(`/public/listings/e6-visible-${unique}/e6-visible-${unique}`)
      .expect(200);

    const body = response.body as {
      title: string;
      attributes: Array<{ code: string; value: string }>;
      images: Array<{ url: string }>;
      business: { whatsapp: string; slug: string };
    };
    expect(body.title).toContain('iPhone E6');
    expect(body.attributes).toContainEqual({
      code: 'marca-e6',
      name: 'Marca E6',
      type: 'TEXT',
      value: 'Apple',
    });
    expect(body.images[0]!.url).toContain('/media/listings/');
    expect(body.business.slug).toBe(`e6-visible-${unique}`);
    expect(body.business.whatsapp).toBe('+573001110001');
  });

  it('9 · el detalle no filtra datos internos del negocio', async () => {
    const response = await server()
      .get(`/public/listings/e6-visible-${unique}/e6-visible-${unique}`)
      .expect(200);

    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('ownerUserId');
    expect(raw).not.toContain('fingerprint');
    expect(raw).not.toContain('marketcentral.test');
  });

  it('10 · una publicación en borrador, vendida o archivada no se puede abrir', async () => {
    for (const slug of [`e6-draft-${unique}`, `e6-sold-${unique}`, `e6-arch-${unique}`]) {
      const response = await server()
        .get(`/public/listings/e6-visible-${unique}/${slug}`)
        .expect(404);
      expect((response.body as { error: string }).error).toBe('PUBLIC_LISTING_NOT_FOUND');
    }
  });

  it('11 · un negocio suspendido no expone su publicación ni su perfil', async () => {
    const missingListing = await server()
      .get(`/public/listings/e6-suspendido-${unique}/e6-susp-${unique}`)
      .expect(404);
    expect((missingListing.body as { error: string }).error).toBe('PUBLIC_LISTING_NOT_FOUND');

    const missingBusiness = await server()
      .get(`/public/businesses/e6-suspendido-${unique}`)
      .expect(404);
    expect((missingBusiness.body as { error: string }).error).toBe('PUBLIC_BUSINESS_NOT_FOUND');
  });

  it('12 · una suscripción vencida oculta su publicación', async () => {
    await server().get(`/public/listings/e6-vencido-${unique}/e6-exp-${unique}`).expect(404);
  });

  it('13 · el perfil del negocio solo lista publicaciones visibles', async () => {
    const response = await server().get(`/public/businesses/e6-visible-${unique}`).expect(200);

    const body = response.body as { listings: { items: Array<{ listingSlug: string }> } };
    expect(body.listings.items).toHaveLength(1);
    expect(body.listings.items[0]!.listingSlug).toBe(`e6-visible-${unique}`);
  });

  it('14 · rechaza filtros incoherentes', async () => {
    const range = await server().get('/public/listings?minPrice=900&maxPrice=100').expect(400);
    expect((range.body as { error: string }).error).toBe('INVALID_FILTERS');

    await server().get('/public/listings?limit=100').expect(400);
    await server().get('/public/listings?city=BOGOTA').expect(400);
  });

  it('15 · rechaza una categoría de otra vertical', async () => {
    const response = await server()
      .get(`/public/listings?verticalSlug=prenderias&categoryId=${otherVerticalCategoryId}`)
      .expect(400);
    expect((response.body as { error: string }).error).toBe('INVALID_FILTERS');
  });

  it('15b · filtra por slug de categoría en la URL', async () => {
    const response = await server()
      .get(`/public/listings?verticalSlug=prenderias&category=${categorySlug}`)
      .expect(200);

    const body = response.body as { total: number; items: Array<{ listingSlug: string }> };
    expect(body.total).toBe(2);
    expect(body.items.map((item) => item.listingSlug).sort()).toEqual(
      [`e6-segundo-${unique}`, `e6-visible-${unique}`].sort(),
    );

    const otherVertical = await server()
      .get(`/public/listings?verticalSlug=prenderias&category=e6-otra-${unique}`)
      .expect(400);
    expect((otherVertical.body as { error: string }).error).toBe('INVALID_FILTERS');
  });

  it('15c · rechaza combinar category con categoryId', async () => {
    const response = await server()
      .get(`/public/listings?category=${categorySlug}&categoryId=${categoryId}`)
      .expect(400);
    expect((response.body as { error: string }).error).toBe('INVALID_FILTERS');
  });

  it('16 · una vertical inactiva o inexistente responde 404', async () => {
    const response = await server().get('/public/verticals/no-existe-e6').expect(404);
    expect((response.body as { error: string }).error).toBe('PUBLIC_VERTICAL_NOT_FOUND');
  });

  it('17 · el sitemap solo incluye contenido visible', async () => {
    const response = await server().get('/public/sitemap?limit=500').expect(200);

    const entries = response.body as Array<{ businessSlug: string; listingSlug: string | null }>;
    const forSuite = entries.filter(
      (entry) => entry.businessSlug.startsWith('e6-') || entry.listingSlug?.includes(unique),
    );
    expect(forSuite.every((entry) => entry.listingSlug !== `e6-draft-${unique}`)).toBe(true);
    expect(forSuite.every((entry) => entry.listingSlug !== `e6-susp-${unique}`)).toBe(true);
    const visibleEntries = entries.filter((entry) => entry.businessSlug === `e6-visible-${unique}`);
    expect(visibleEntries).toHaveLength(2);
    expect(visibleEntries.filter((entry) => entry.listingSlug === null)).toHaveLength(1);
  });

  it('18 · el rate limiting corta tras superar el máximo de la ventana', () => {
    process.env.PUBLIC_RATE_LIMIT = '3';
    const guard = new PublicRateLimitGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '10.0.0.9',
          path: '/public/listings',
          route: { path: '/public/listings' },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
    process.env.PUBLIC_RATE_LIMIT = undefined;
  });
});
