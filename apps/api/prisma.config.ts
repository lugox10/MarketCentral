import { defineConfig } from 'prisma/config';

/**
 * Configuración del CLI de Prisma 7.
 *
 * `DATABASE_URL` se toma del entorno. Para el desarrollo local se usa como
 * respaldo la cadena del contenedor de `infrastructure/docker/docker-compose.yml`
 * (PostgreSQL 18.6 en 127.0.0.1:5432) para que `prisma migrate` y `db:seed`
 * funcionen sin exportar variables a mano. En CI y producción la variable es
 * obligatoria.
 */
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
  },
});
