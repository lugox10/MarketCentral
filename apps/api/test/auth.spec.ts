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
const EMAIL = `e1-${unique}@marketcentral.test`;
const PASSWORD = 'ClaveSegura1';

async function databaseAvailable(): Promise<boolean> {
  const probe = new PrismaClient({
    adapter: new PrismaPg({ connectionString: DATABASE_URL }),
  });
  try {
    await probe.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await probe.$disconnect();
  }
}

/**
 * La sonda se resuelve antes de declarar los casos para que, sin PostgreSQL,
 * Jest los reporte como omitidos y no como aprobados (E1-H1…E1-H4).
 */
const databaseIsAvailable = await databaseAvailable();

if (!databaseIsAvailable) {
  console.warn(
    '[auth.spec] PostgreSQL no disponible en DATABASE_URL; los casos de integración se reportan como omitidos. ' +
      'Ejecuta `docker compose -f infrastructure/docker/docker-compose.yml up -d` y las migraciones.',
  );
}

const describeIntegration = databaseIsAvailable ? describe : describe.skip;

describeIntegration('Auth (E1) · integración con PostgreSQL', () => {
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    agent = request.agent(app.getHttpServer());
  }, 60_000);

  afterAll(async () => {
    if (!app) return;
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: DATABASE_URL }),
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e1-' } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('POST /auth/register crea la cuenta (201)', async () => {
    const response = await agent
      .post('/auth/register')
      .send({ email: EMAIL, password: PASSWORD, name: 'Prueba E1' })
      .expect(201);

    expect(response.body).toMatchObject({ email: EMAIL, name: 'Prueba E1' });
    expect(response.body.passwordHash).toBeUndefined();
  });

  it('POST /auth/register con correo duplicado devuelve 409', async () => {
    await agent
      .post('/auth/register')
      .send({ email: EMAIL, password: PASSWORD, name: 'Prueba E1' })
      .expect(409);
  });

  it('POST /auth/register con contraseña débil devuelve 400', async () => {
    await agent
      .post('/auth/register')
      .send({ email: `debil-${unique}@marketcentral.test`, password: 'corta', name: 'Débil' })
      .expect(400);
  });

  it('POST /auth/login correcto devuelve 200 y cookie HttpOnly', async () => {
    const response = await agent
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);

    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((cookie) => cookie.startsWith('mc_session='))).toBe(true);
    expect(cookies.join(';')).toContain('HttpOnly');
  });

  it('POST /auth/login con contraseña incorrecta devuelve 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: 'Incorrecta1' })
      .expect(401);
  });

  it('GET /auth/me sin cookie devuelve 401', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('GET /auth/me con cookie devuelve 200 y el perfil', async () => {
    const response = await agent.get('/auth/me').expect(200);
    expect(response.body).toMatchObject({ email: EMAIL, role: 'BUSINESS_OWNER' });
  });

  it('POST /auth/logout revoca la sesión y /auth/me vuelve a 401', async () => {
    await agent.post('/auth/logout').expect(204);
    await agent.get('/auth/me').expect(401);
  });
});
