import * as dotenv from 'dotenv';
import * as path from 'path';
import { defineConfig } from 'prisma/config';

// Cargar el .env que está en la raíz del monorepo (subiendo dos niveles)
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const LOCAL_DATABASE_URL =
  'postgresql://postgres:postgres@127.0.0.1:5432/marketcentral_dev?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? LOCAL_DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
  },
});
