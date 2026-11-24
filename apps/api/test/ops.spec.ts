import type { NextFunction, Request, Response } from 'express';

import { InternalErrorFilter } from '../src/common/observability/internal-error.filter.js';
import {
  normalizePath,
  requestLogger,
} from '../src/common/observability/request-logger.middleware.js';
import {
  escapeHtml,
  maskEmail,
  ResendMailSender,
} from '../src/modules/auth/infrastructure/resend-mail-sender.js';

function fakeRequest(path: string, route?: string): Request {
  return { method: 'GET', path, baseUrl: '', ...(route ? { route: { path: route } } : {}) } as Request;
}

describe('observabilidad · logger de peticiones', () => {
  it('normaliza identificadores para agrupar métricas por ruta', () => {
    expect(normalizePath(fakeRequest('/businesses/9f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f'))).toBe(
      '/businesses/:id',
    );
    expect(normalizePath(fakeRequest('/public/listings/prenderia/nevera-aceb-6bxc3l'))).toBe(
      '/public/listings/prenderia/nevera-aceb-6bxc3l',
    );
  });

  it('adjunta un request id y no registra cuerpos ni query', () => {
    const headers: Record<string, string> = {};
    let finished: (() => void) | null = null;
    const response = {
      locals: {} as Record<string, unknown>,
      statusCode: 201,
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
      on: (event: string, callback: () => void) => {
        if (event === 'finish') finished = callback;
      },
    } as unknown as unknown as Response;

    const request = {
      method: 'POST',
      path: '/public/leads',
      baseUrl: '',
      body: { buyerEmail: 'persona@example.com' },
    } as unknown as Request;

    let called = false;
    requestLogger(request, response, (() => {
      called = true;
    }) as NextFunction);

    expect(called).toBe(true);
    expect(headers['X-Request-Id']).toMatch(/[0-9a-f-]{36}/);
    expect(response.locals.requestId).toBe(headers['X-Request-Id']);
    expect(typeof finished).toBe('function');
  });
});

describe('observabilidad · filtro de errores internos', () => {
  it('responde 500 genérico con requestId cuando el error no es HttpException', () => {
    const calls: Array<{ status?: number; body?: unknown }> = [];
    const status = (code: number) => ({
      json: (body: unknown) => calls.push({ status: code, body }),
    });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ locals: { requestId: 'req-1' }, headersSent: false, status }),
        getRequest: () => ({ method: 'GET', path: '/x' }),
      }),
    };

    new InternalErrorFilter().catch(new Error('boom'), host as never);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.status).toBe(500);
    expect(calls[0]?.body).toEqual({
      statusCode: 500,
      error: 'INTERNAL_ERROR',
      message: expect.stringContaining('Algo salió mal'),
      requestId: 'req-1',
    });
  });
});

describe('correo · Resend', () => {
  const config = {
    get: (key: string) => (key === 'RESEND_API_KEY' ? 're_test' : undefined),
  };
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('envía el correo con la clave y escapa el HTML del contenido', async () => {
    const calls: Array<[string, RequestInit]> = [];
    global.fetch = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return { ok: true, status: 200 } as unknown as Response;
    }) as unknown as typeof fetch;

    const sender = new ResendMailSender(config as never);
    await sender.sendNewLeadEmail({
      to: 'duena@example.com',
      name: 'Dueña',
      businessName: 'Prendería <Centro>',
      buyerName: 'Ana & Luis',
      listingTitle: null,
      messagePreview: 'Hola <script>',
      leadId: 'lead-1',
    });

    expect(calls).toHaveLength(1);
    const [url, init] = calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test');
    const payload = JSON.parse(String(init.body)) as { to: string[]; html: string };
    expect(payload.to).toEqual(['duena@example.com']);
    expect(payload.html).not.toContain('<script>');
    expect(payload.html).toContain('&lt;script&gt;');
  });

  it('lanza y no filtra la clave cuando el proveedor rechaza', async () => {
    global.fetch = (async () => ({ ok: false, status: 422 }) as unknown as Response) as unknown as typeof fetch;
    const sender = new ResendMailSender(config as never);

    await expect(
      sender.sendVerificationEmail({ to: 'a@b.co', name: 'A', token: 'tok' }),
    ).rejects.toThrow('estado 422');
  });
});

describe('correo · utilidades', () => {
  it('enmascara el correo en los logs', () => {
    expect(maskEmail('persona@example.com')).toBe('pe*****@example.com');
    expect(maskEmail('sin-arroba')).toBe('***');
  });

  it('escapa los cinco caracteres peligrosos', () => {
    expect(escapeHtml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#39;');
  });
});
