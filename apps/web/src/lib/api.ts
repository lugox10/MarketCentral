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
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
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
export function postJson<T>(
  path: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  return request<T>('POST', path, body, extraHeaders);
}

export function patchJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PATCH', path, body);
}

export function getJson<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export function deleteJson<T>(path: string): Promise<T> {
  return request<T>('DELETE', path);
}

/**
 * Sube un `FormData` (multipart). No se fija `Content-Type`: el navegador debe
 * poner el boundary del multipart, y fijarlo a mano rompería la petición.
 */
export async function postForm<T>(path: string, form: FormData): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });

  if (!response.ok) {
    let message = 'No se pudo subir el archivo';
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

  return (await response.json()) as T;
}
