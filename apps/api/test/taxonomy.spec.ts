import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { PrismaPg } from '@prisma/adapter-pg';
import prismaClientPkg from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { seedTaxonomy } from '../src/modules/taxonomy/application/taxonomy-seed.js';

// Mismo interop que `prisma.service.ts`: `@prisma/client` es CommonJS.
const PrismaClient = prismaClientPkg.PrismaClient;

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/marketcentral_test';

const uid = Date.now().toString(36);
const ADMIN_EMAIL = `e3-admin-${uid}@marketcentral.test`;
const OWNER_EMAIL = `e3-owner-${uid}@marketcentral.test`;
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
    '[taxonomy.spec] PostgreSQL no disponible en DATABASE_URL; los casos de integración se omiten. ' +
      'Ejecuta el contenedor y aplica las migraciones (ver README).',
  );
}

const describeIntegration = databaseIsAvailable ? describe : describe.skip;

describeIntegration('Taxonomy (E3) · integración con PostgreSQL', () => {
  let app: INestApplication;
  let adminAgent: ReturnType<typeof request.agent>;
  let ownerAgent: ReturnType<typeof request.agent>;
  const createdVerticalIds: string[] = [];
  let verticalId = '';
  let categoryId = '';
  let secondVerticalId = '';
  let textAttributeId = '';
  let enumAttributeId = '';

  const server = (): ReturnType<typeof request> => request(app.getHttpServer());

  const register = async (
    agent: ReturnType<typeof request.agent>,
    email: string,
  ): Promise<void> => {
    await agent
      .post('/auth/register')
      .send({ email, password: PASSWORD, name: 'Prueba E3' })
      .expect(201);
    await agent.post('/auth/login').send({ email, password: PASSWORD }).expect(200);
  };

  beforeAll(async () => {
    // La taxonomía sembrada es idempotente y sirve para las consultas públicas.
    await seedTaxonomy(prisma as never);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    adminAgent = request.agent(app.getHttpServer());
    ownerAgent = request.agent(app.getHttpServer());

    await register(adminAgent, ADMIN_EMAIL);
    await register(ownerAgent, OWNER_EMAIL);

    await prisma.user.update({ where: { email: ADMIN_EMAIL }, data: { role: 'SUPER_ADMIN' } });
    await adminAgent.post('/auth/logout').expect(204);
    await adminAgent
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: PASSWORD })
      .expect(200);
  }, 120_000);

  afterAll(async () => {
    if (databaseIsAvailable) {
      if (createdVerticalIds.length > 0) {
        const categories = await prisma.category.findMany({
          where: { verticalId: { in: createdVerticalIds } },
          select: { id: true },
        });
        const categoryIds = categories.map((category) => category.id);
        await prisma.attributeDefinition.deleteMany({ where: { categoryId: { in: categoryIds } } });
        await prisma.category.deleteMany({ where: { verticalId: { in: createdVerticalIds } } });
        await prisma.vertical.deleteMany({ where: { id: { in: createdVerticalIds } } });
      }
      await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, OWNER_EMAIL] } } });
    }
    await prisma.$disconnect();
    if (app) await app.close();
  });

  it('1 · POST /admin/taxonomy/verticals crea la vertical (201)', async () => {
    const response = await adminAgent
      .post('/admin/taxonomy/verticals')
      .send({ name: `Joyerías ${uid}` })
      .expect(201);

    verticalId = response.body.id as string;
    createdVerticalIds.push(verticalId);

    expect(response.body).toMatchObject({
      name: `Joyerías ${uid}`,
      slug: `joyerias-${uid}`,
      isActive: true,
    });

    const persisted = await prisma.vertical.findUnique({ where: { id: verticalId } });
    expect(persisted?.slug).toBe(`joyerias-${uid}`);
  });

  it('2 · POST /admin/taxonomy/categories crea la categoría vinculada (201)', async () => {
    const response = await adminAgent
      .post('/admin/taxonomy/categories')
      .send({ verticalId, name: 'Anillos', slug: `anillos-${uid}` })
      .expect(201);

    categoryId = response.body.id as string;
    expect(response.body).toMatchObject({ verticalId, slug: `anillos-${uid}`, parentId: null });
  });

  it('3 · POST /admin/taxonomy/attributes crea un atributo TEXT (201)', async () => {
    const response = await adminAgent
      .post('/admin/taxonomy/attributes')
      .send({ categoryId, name: 'Marca', code: 'marca', type: 'TEXT' })
      .expect(201);

    textAttributeId = response.body.id as string;
    expect(response.body).toMatchObject({
      categoryId,
      code: 'marca',
      type: 'TEXT',
      isRequired: false,
      isFilterable: true,
      options: [],
    });

    const persisted = await prisma.attributeDefinition.findUnique({
      where: { id: textAttributeId },
    });
    expect(persisted?.code).toBe('marca');
  });

  it('4 · POST /admin/taxonomy/attributes crea un ENUM con sus opciones (201)', async () => {
    const response = await adminAgent
      .post('/admin/taxonomy/attributes')
      .send({
        categoryId,
        name: 'Almacenamiento',
        code: 'almacenamiento',
        type: 'ENUM',
        options: ['64GB', '128GB', '256GB'],
      })
      .expect(201);

    enumAttributeId = response.body.id as string;
    expect(response.body.options.map((option: { value: string }) => option.value)).toEqual([
      '128GB',
      '256GB',
      '64GB',
    ]);

    const options = await prisma.attributeOption.count({
      where: { attributeDefinitionId: enumAttributeId },
    });
    expect(options).toBe(3);
  });

  it('5 · un BUSINESS_OWNER no puede crear verticales (403)', async () => {
    await ownerAgent
      .post('/admin/taxonomy/verticals')
      .send({ name: `Intruso ${uid}` })
      .expect(403);
  });

  it('6 · sin sesión, el endpoint administrativo responde 401', async () => {
    await server()
      .post('/admin/taxonomy/verticals')
      .send({ name: `Anónimo ${uid}` })
      .expect(401);
  });

  it('7 · GET /taxonomy/verticals es público y devuelve las activas', async () => {
    const response = await server().get('/taxonomy/verticals').expect(200);

    const slugs = response.body.items.map((item: { slug: string }) => item.slug);
    expect(slugs).toContain('prenderias');
    expect(slugs).toContain(`joyerias-${uid}`);
  });

  it('9 · un slug de vertical repetido responde 409', async () => {
    await adminAgent
      .post('/admin/taxonomy/verticals')
      .send({ name: `Joyerías duplicada ${uid}`, slug: `joyerias-${uid}` })
      .expect(409);
  });

  it('10 · un code repetido en la misma categoría responde 409', async () => {
    await adminAgent
      .post('/admin/taxonomy/attributes')
      .send({ categoryId, name: 'Marca bis', code: 'marca', type: 'TEXT' })
      .expect(409);
  });

  it('11 · el mismo slug de categoría se permite en otra vertical', async () => {
    const vertical = await adminAgent
      .post('/admin/taxonomy/verticals')
      .send({ name: `Zapaterías ${uid}` })
      .expect(201);
    secondVerticalId = vertical.body.id as string;
    createdVerticalIds.push(secondVerticalId);

    await adminAgent
      .post('/admin/taxonomy/categories')
      .send({ verticalId: secondVerticalId, name: 'Anillos', slug: `anillos-${uid}` })
      .expect(201);
  });

  it('12 · un tipo no soportado responde 400', async () => {
    await adminAgent
      .post('/admin/taxonomy/attributes')
      .send({ categoryId, name: 'Fecha', code: 'fecha', type: 'DATE' })
      .expect(400);
  });

  it('13 · un ENUM sin opciones responde 400', async () => {
    await adminAgent
      .post('/admin/taxonomy/attributes')
      .send({ categoryId, name: 'Color', code: 'color', type: 'ENUM', options: [] })
      .expect(400);
  });

  it('14 · un ENUM con opciones duplicadas responde 400', async () => {
    await adminAgent
      .post('/admin/taxonomy/attributes')
      .send({ categoryId, name: 'Color', code: 'color', type: 'ENUM', options: ['Rojo', 'rojo'] })
      .expect(400);
  });

  it('15 · un TEXT con opciones responde 400', async () => {
    await adminAgent
      .post('/admin/taxonomy/attributes')
      .send({ categoryId, name: 'Color', code: 'color', type: 'TEXT', options: ['Rojo'] })
      .expect(400);
  });

  it('16 · un nombre vacío responde 400', async () => {
    await adminAgent.post('/admin/taxonomy/verticals').send({ name: '   ' }).expect(400);
  });

  it('17 · un slug con formato inválido responde 400', async () => {
    await adminAgent
      .post('/admin/taxonomy/verticals')
      .send({ name: `Formato ${uid}`, slug: 'Mal Slug!' })
      .expect(400);
  });

  it('18 · si falla la creación del atributo no quedan opciones a medias', async () => {
    const before = await prisma.attributeOption.count({
      where: { attributeDefinitionId: enumAttributeId },
    });

    // Code duplicado: la comprobación previa responde 409 y no se crea nada.
    await adminAgent
      .post('/admin/taxonomy/attributes')
      .send({
        categoryId,
        name: 'Almacenamiento bis',
        code: 'almacenamiento',
        type: 'ENUM',
        options: ['512GB'],
      })
      .expect(409);

    const after = await prisma.attributeOption.count({
      where: { attributeDefinitionId: enumAttributeId },
    });
    // Se busca dentro de la categoría de la prueba: el seed también crea opciones "512GB".
    const orphan = await prisma.attributeOption.count({
      where: { value: '512GB', attributeDefinition: { categoryId } },
    });

    expect(after).toBe(before);
    expect(orphan).toBe(0);
  });

  it('19 · una categoría padre de otra vertical responde 400', async () => {
    const foreign = await prisma.category.findFirst({
      where: { verticalId: { not: verticalId } },
      select: { id: true },
    });
    expect(foreign).not.toBeNull();

    await adminAgent
      .post('/admin/taxonomy/categories')
      .send({ verticalId, name: 'Sub categoría', parentId: foreign?.id })
      .expect(400);
  });

  it('20 · las categorías de una vertical inexistente responden 404', async () => {
    await server()
      .get('/taxonomy/verticals/00000000-0000-7000-8000-000000000000/categories')
      .expect(404);
  });

  it('21 · los atributos de una categoría inexistente responden 404', async () => {
    await server()
      .get('/taxonomy/categories/00000000-0000-7000-8000-000000000000/attributes')
      .expect(404);
  });

  it('22 · GET de atributos devuelve el ENUM con sus opciones', async () => {
    const response = await server()
      .get(`/taxonomy/categories/${categoryId}/attributes`)
      .expect(200);

    const enumAttribute = response.body.items.find(
      (item: { code: string }) => item.code === 'almacenamiento',
    );
    expect(enumAttribute.type).toBe('ENUM');
    expect(enumAttribute.options).toHaveLength(3);
  });

  it('23 · ejecutar el seed dos veces no duplica la taxonomía', async () => {
    const countAll = async () => ({
      verticals: await prisma.vertical.count({ where: { slug: 'prenderias' } }),
      categories: await prisma.category.count({
        where: { slug: 'celulares', vertical: { slug: 'prenderias' } },
      }),
      attributes: await prisma.attributeDefinition.count({
        where: { category: { vertical: { slug: 'prenderias' } } },
      }),
      options: await prisma.attributeOption.count({
        where: {
          attributeDefinition: { code: 'almacenamiento', category: { slug: 'celulares' } },
        },
      }),
    });

    await seedTaxonomy(prisma as never);
    const afterFirst = await countAll();
    await seedTaxonomy(prisma as never);
    const afterSecond = await countAll();

    expect(afterSecond).toEqual(afterFirst);
    expect(afterSecond.verticals).toBe(1);
    expect(afterSecond.categories).toBe(1);
    expect(afterSecond.attributes).toBeGreaterThanOrEqual(3);
    expect(afterSecond.options).toBeGreaterThanOrEqual(4);
  });

  it('24 · los atributos públicos se pueden consultar sin sesión', async () => {
    await server().get(`/taxonomy/verticals/${verticalId}/categories`).expect(200);
  });

  it('25 · desactivar una vertical la retira del catálogo público pero sigue en el panel', async () => {
    await adminAgent
      .patch(`/admin/taxonomy/verticals/${verticalId}`)
      .send({ isActive: false })
      .expect(200);

    const publicList = await server().get('/taxonomy/verticals').expect(200);
    expect(publicList.body.items.map((item: { id: string }) => item.id)).not.toContain(verticalId);

    const adminList = await adminAgent.get('/admin/taxonomy/verticals').expect(200);
    const row = adminList.body.items.find((item: { id: string }) => item.id === verticalId);
    expect(row.isActive).toBe(false);

    await adminAgent
      .patch(`/admin/taxonomy/verticals/${verticalId}`)
      .send({ isActive: true })
      .expect(200);
  });

  it('26 · desactivar una categoría la oculta al público y la mantiene en el panel', async () => {
    await adminAgent
      .patch(`/admin/taxonomy/categories/${categoryId}`)
      .send({ isActive: false })
      .expect(200);

    const publicList = await server()
      .get(`/taxonomy/verticals/${verticalId}/categories`)
      .expect(200);
    expect(publicList.body.items.map((item: { id: string }) => item.id)).not.toContain(categoryId);

    const adminList = await adminAgent
      .get(`/admin/taxonomy/verticals/${verticalId}/categories`)
      .expect(200);
    const row = adminList.body.items.find((item: { id: string }) => item.id === categoryId);
    expect(row.isActive).toBe(false);

    await adminAgent
      .patch(`/admin/taxonomy/categories/${categoryId}`)
      .send({ isActive: true })
      .expect(200);
  });

  it('27 · editar un atributo cambia el nombre y los flags sin tocar su code', async () => {
    const updated = await adminAgent
      .patch(`/admin/taxonomy/attributes/${enumAttributeId}`)
      .send({ name: 'Capacidad', isRequired: true, isFilterable: false })
      .expect(200);

    expect(updated.body.name).toBe('Capacidad');
    expect(updated.body.code).toBe('almacenamiento');
    expect(updated.body.isRequired).toBe(true);
    expect(updated.body.isFilterable).toBe(false);
  });

  it('28 · desactivar un atributo lo retira del público y conserva sus opciones', async () => {
    await adminAgent
      .patch(`/admin/taxonomy/attributes/${enumAttributeId}`)
      .send({ isActive: false })
      .expect(200);

    const publicList = await server()
      .get(`/taxonomy/categories/${categoryId}/attributes`)
      .expect(200);
    expect(publicList.body.items.map((item: { id: string }) => item.id)).not.toContain(
      enumAttributeId,
    );

    const adminList = await adminAgent
      .get(`/admin/taxonomy/categories/${categoryId}/attributes`)
      .expect(200);
    const row = adminList.body.items.find((item: { id: string }) => item.id === enumAttributeId);
    expect(row.isActive).toBe(false);
    expect(row.options.length).toBe(3);

    await adminAgent
      .patch(`/admin/taxonomy/attributes/${enumAttributeId}`)
      .send({ isActive: true })
      .expect(200);
  });

  it('29 · desactivar una opción la oculta del formulario público', async () => {
    const option = await prisma.attributeOption.findFirst({
      where: { attributeDefinitionId: enumAttributeId },
      orderBy: { value: 'asc' },
    });
    expect(option).not.toBeNull();

    await adminAgent
      .patch(`/admin/taxonomy/attributes/${enumAttributeId}/options/${option?.id}`)
      .send({ isActive: false })
      .expect(200);

    const publicList = await server()
      .get(`/taxonomy/categories/${categoryId}/attributes`)
      .expect(200);
    const row = publicList.body.items.find((item: { id: string }) => item.id === enumAttributeId);
    expect(row.options.map((item: { value: string }) => item.value)).not.toContain(option?.value);

    await adminAgent
      .patch(`/admin/taxonomy/attributes/${enumAttributeId}/options/${option?.id}`)
      .send({ isActive: true })
      .expect(200);
  });

  it('30 · un PATCH vacío o un id inexistente responden 400 y 404', async () => {
    await adminAgent.patch(`/admin/taxonomy/categories/${categoryId}`).send({}).expect(400);

    await adminAgent
      .patch('/admin/taxonomy/attributes/00000000-0000-7000-8000-000000000000')
      .send({ isActive: false })
      .expect(404);

    await adminAgent
      .patch('/admin/taxonomy/verticals/00000000-0000-7000-8000-000000000000')
      .send({ name: 'Otra' })
      .expect(404);

    await adminAgent
      .patch(
        `/admin/taxonomy/attributes/${enumAttributeId}/options/00000000-0000-7000-8000-000000000000`,
      )
      .send({ isActive: false })
      .expect(404);
  });

  it('32 · añade una opción nueva a un atributo ENUM y rechaza duplicados', async () => {
    const created = await adminAgent
      .post(`/admin/taxonomy/attributes/${enumAttributeId}/options`)
      .send({ value: '1TB' })
      .expect(201);

    expect(created.body.value).toBe('1TB');
    expect(created.body.isActive).toBe(true);

    await adminAgent
      .post(`/admin/taxonomy/attributes/${enumAttributeId}/options`)
      .send({ value: '1tb' })
      .expect(409);

    await adminAgent
      .post(`/admin/taxonomy/attributes/${textAttributeId}/options`)
      .send({ value: 'No aplica' })
      .expect(400);

    const publicList = await server()
      .get(`/taxonomy/categories/${categoryId}/attributes`)
      .expect(200);
    const row = publicList.body.items.find((item: { id: string }) => item.id === enumAttributeId);
    expect(row.options.map((item: { value: string }) => item.value)).toContain('1TB');
  });

  it('31 · un BUSINESS_OWNER no puede desactivar nada (403)', async () => {
    await ownerAgent
      .patch(`/admin/taxonomy/verticals/${verticalId}`)
      .send({ isActive: false })
      .expect(403);
  });
});
