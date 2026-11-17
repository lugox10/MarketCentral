/** URL pública del backend; se inyecta en build desde NEXT_PUBLIC_API_URL. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface ApiErrorBody {
  statusCode?: number;
  error?: string;
  message?: string | string[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    let message = 'No se pudo completar la operación';
    let code: string | undefined;
    try {
      const payload = (await response.json()) as ApiErrorBody;
      const raw = Array.isArray(payload.message) ? payload.message.join('. ') : payload.message;
      if (raw) message = raw;
      code = typeof payload.error === 'string' ? payload.error : undefined;
    } catch {
      // Respuesta sin cuerpo JSON: se conserva el mensaje genérico.
    }
    throw new ApiError(response.status, message, code);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** POST con cookies incluidas: la sesión vive en una cookie HttpOnly. */
export function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

export function patchJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PATCH', path, body);
}

export function getJson<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}
