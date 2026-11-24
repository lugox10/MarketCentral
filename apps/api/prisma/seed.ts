import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

// ... el resto de tus importaciones y el código del seed
import { PrismaPg } from '@prisma/adapter-pg';
import prismaClientPkg from '@prisma/client';
import argon2 from 'argon2';

import { seedTaxonomy } from '../src/modules/taxonomy/application/taxonomy-seed.ts';

// `@prisma/client` es CommonJS: el import por defecto mantiene el interop tanto
// en Node 22.12+ como en Node 24.
const PrismaClient = prismaClientPkg.PrismaClient;

const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@marketcentral.com';
const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'Admin123$';
const ADMIN_NAME = process.env.SUPER_ADMIN_NAME || 'Super Admin';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/marketcentral_dev?schema=public';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(ADMIN_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash, name: ADMIN_NAME, role: 'SUPER_ADMIN', status: 'ACTIVE' },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: ADMIN_NAME,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  // Planes del MVP (E4, D-35): Free = 10 publicaciones y dos meses calendario
  // de prueba; Base y Pro = activación pagada de 30 días.
  const plans = [
    {
      code: 'FREE' as const,
      name: 'Free',
      priceCop: 0,
      currency: 'COP',
      maxListings: 10,
      trialMonths: 2,
      billingPeriodDays: null,
    },
    {
      code: 'BASE' as const,
      name: 'Base',
      priceCop: 30_000,
      currency: 'COP',
      maxListings: 30,
      trialMonths: 0,
      billingPeriodDays: 30,
    },
    {
      code: 'PRO' as const,
      name: 'Pro',
      priceCop: 50_000,
      currency: 'COP',
      maxListings: 50,
      trialMonths: 0,
      billingPeriodDays: 30,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        priceCop: plan.priceCop,
        currency: plan.currency,
        maxListings: plan.maxListings,
        trialMonths: plan.trialMonths,
        billingPeriodDays: plan.billingPeriodDays,
        isActive: true,
      },
      create: { ...plan, isActive: true },
    });
  }

  // Taxonomía global inicial (E3): verticales base + taxonomía de referencia de Prenderías.
  const taxonomy = await seedTaxonomy(prisma);

  // Usamos process.stdout.write en lugar de console.log para pasar la regla de ESLint
  process.stdout.write(
    `seed ok: ${admin.email} (${admin.role}) + ${plans.length} planes + ` +
      `${taxonomy.verticals} verticales [${taxonomy.slugs.join(', ')}] ` +
      `(${taxonomy.categories} categorías, ${taxonomy.attributes} atributos, ` +
      `${taxonomy.options} opciones)\n`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('seed falló:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
