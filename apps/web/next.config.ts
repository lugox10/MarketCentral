import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

/**
 * Web app de MarketCentral.
 *
 * Notas de bootstrap:
 * - El entorno vive en la raíz del monorepo (`.env`), no en `apps/web`, para que
 *   API y web lean el mismo archivo. `loadEnvConfig` con la raíz permite que
 *   `next dev`/`next build`/`next start` resuelvan `NEXT_PUBLIC_API_URL` igual
 *   que lo hace `@nestjs/config` en la API.
 * - `transpilePackages` permite consumir los paquetes del workspace escritos en TS.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
loadEnvConfig(path.resolve(here, '../..'));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Se incrusta en el bundle del servidor y del cliente: así `next start` no
  // depende de que la variable exista en el shell (Next solo lee `.env` de
  // `apps/web`, y el entorno de este monorepo vive en la raíz).
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  },

  transpilePackages: ['@marketcentral/ui', '@marketcentral/api-client'],
};

export default nextConfig;
