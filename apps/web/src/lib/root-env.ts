import path from 'node:path';

import { loadEnvConfig } from '@next/env';

/**
 * Carga el `.env` de la raíz del monorepo.
 *
 * Next solo busca `.env*` dentro del directorio de la app (`apps/web`), pero en
 * este monorepo el entorno es compartido con la API y vive en la raíz. Se carga
 * explícitamente al arrancar el servidor.
 *
 * Este módulo solo se importa dinámicamente desde `instrumentation.ts` y solo en
 * el runtime Node, porque usa APIs que no existen en Edge.
 */
export function loadRootEnv(): void {
  loadEnvConfig(path.resolve(process.cwd(), '../..'));
}
