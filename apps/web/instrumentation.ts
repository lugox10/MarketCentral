/**
 * Hook de arranque del servidor Next.js.
 *
 * Valida el entorno una sola vez, al iniciar el proceso, en lugar de descubrir
 * una variable ausente en la primera petición.
 *
 * El `.env` compartido vive en la raíz del monorepo, así que se carga aquí: Next
 * solo mira `apps/web`. Las importaciones son dinámicas y ocurren únicamente en
 * el runtime Node, para no arrastrar APIs de Node al bundle Edge.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { loadRootEnv } = await import('./src/lib/root-env');
  loadRootEnv();

  const { assertWebEnv } = await import('./src/lib/env');
  const env = assertWebEnv();
  // eslint-disable-next-line no-console
  console.info(`[web] API configurada en ${env.apiBaseUrl}`);
}
