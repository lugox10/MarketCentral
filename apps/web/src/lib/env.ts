/**
 * Configuración pública del frontend.
 *
 * `NEXT_PUBLIC_*` se incrusta en el bundle en tiempo de build, así que la
 * validación ocurre al arrancar el servidor (ver `instrumentation.ts`) y falla
 * de forma explícita si la URL falta o no es válida.
 */
const FALLBACK_DEV_API_URL = 'http://localhost:3001';

export type WebEnv = {
  apiBaseUrl: string;
  isProduction: boolean;
};

export function readWebEnv(raw: NodeJS.ProcessEnv = process.env): WebEnv {
  const isProduction = raw.NODE_ENV === 'production';
  const configured = raw.NEXT_PUBLIC_API_URL?.trim();
  const value =
    configured && configured.length > 0 ? configured : isProduction ? '' : FALLBACK_DEV_API_URL;

  if (!value) {
    throw new Error('NEXT_PUBLIC_API_URL es obligatoria en producción');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`NEXT_PUBLIC_API_URL no es una URL válida: "${value}"`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`NEXT_PUBLIC_API_URL debe usar http(s): "${value}"`);
  }

  if (isProduction && url.protocol !== 'https:' && !isLoopback(url.hostname)) {
    throw new Error('NEXT_PUBLIC_API_URL debe usar https en producción');
  }

  return { apiBaseUrl: url.origin + (url.pathname === '/' ? '' : url.pathname), isProduction };
}

/**
 * `next start` fija NODE_ENV=production incluso en local, así que se permite
 * http solo para loopback: así se puede verificar el build en la máquina sin
 * relajar la regla de https para hosts reales.
 */
function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/** Se llama al arrancar el servidor para fallar temprano si el entorno está mal. */
export function assertWebEnv(): WebEnv {
  return readWebEnv();
}
