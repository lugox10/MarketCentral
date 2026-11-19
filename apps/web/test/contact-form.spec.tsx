import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ContactBusinessButton } from '@/components/contact-business-form';

interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function jsonResponse(payload: unknown, status = 200): FakeResponse {
  return { ok: status < 400, status, json: async () => payload };
}

describe('formulario público de contacto', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/public/leads/form-token')) {
        return jsonResponse({ token: 'v1.abc.def', minSeconds: 3, ttlSeconds: 7200 }) as never;
      }
      return jsonResponse({ ok: true, message: 'Recibido' }, 201) as never;
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('abre el diálogo, bloquea el envío durante 3 s y valida en el cliente', async () => {
    jest.useFakeTimers();
    render(<ContactBusinessButton businessSlug="prenderia" businessName="Prendería Centro" />);

    fireEvent.click(screen.getByRole('button', { name: /enviar mensaje al negocio/i }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/Escribir a Prendería Centro/)).toBeTruthy();

    const waiting = screen.getByRole('button', { name: /espera/i }) as HTMLButtonElement;
    expect(waiting.disabled).toBe(true);

    for (let second = 0; second < 3; second += 1) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });
    }

    const submit = screen.getByRole('button', { name: /^enviar mensaje$/i });
    expect((submit as HTMLButtonElement).disabled).toBe(false);

    fireEvent.submit(document.getElementById('contact-form') as HTMLFormElement);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Escribe tu nombre/i)).toBeTruthy();
    expect(screen.getByText(/Revisa el correo/i)).toBeTruthy();
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(1);
  });

  it('envía el lead con consentimiento y muestra la confirmación', async () => {
    render(<ContactBusinessButton businessSlug="prenderia" businessName="Prendería Centro" />);

    fireEvent.click(screen.getByRole('button', { name: /enviar mensaje al negocio/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    await waitFor(
      () => expect(screen.getByRole('button', { name: /^enviar mensaje$/i })).toBeTruthy(),
      { timeout: 5000 },
    );

    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Ana Pérez' } });
    fireEvent.change(screen.getByLabelText('Correo'), {
      target: { value: 'ana@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Teléfono o WhatsApp'), {
      target: { value: '3001234567' },
    });
    fireEvent.change(screen.getByLabelText('Mensaje'), {
      target: { value: 'Hola, me interesa el artículo. ¿Sigue disponible?' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    await act(async () => {
      fireEvent.submit(document.getElementById('contact-form') as HTMLFormElement);
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByText(/Mensaje enviado/i)).toBeTruthy());

    const calls = (global.fetch as jest.Mock).mock.calls as Array<[string, RequestInit]>;
    const post = calls.find(([url]) => url.endsWith('/public/leads'));
    expect(post).toBeDefined();
    const body = JSON.parse(String(post?.[1]?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      businessSlug: 'prenderia',
      buyerName: 'Ana Pérez',
      consent: true,
      website: '',
    });
    expect(typeof body.formToken).toBe('string');
  });
});
