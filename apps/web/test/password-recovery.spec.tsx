import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ForgotPasswordPage from '../app/(auth)/forgot-password/page';
import ResetPasswordPage from '../app/(auth)/reset-password/page';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock, refresh: jest.fn() }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

let mockSearch = '';

describe('recuperación de contraseña', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    pushMock.mockReset();
    mockSearch = '';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function mockFetch(payload: unknown, status = 202) {
    const calls: Array<{ url: string; body: string }> = [];
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body ?? '') });
      return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => 'application/json' },
        json: async () => payload,
      } as unknown as Response;
    }) as unknown as typeof fetch;
    return calls;
  }

  it('envía el correo normalizado y muestra la confirmación', async () => {
    const calls = mockFetch({});
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText('Correo'), {
      target: { value: '  Persona@Example.COM ' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /Enviar enlace/ }).closest('form')!);

    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(calls[0]!.url).toContain('/auth/password/forgot');
    expect(JSON.parse(calls[0]!.body)).toEqual({ email: 'persona@example.com' });
  });

  it('explica que el enlace no sirve cuando falta el token', () => {
    mockFetch({});
    render(<ResetPasswordPage />);
    expect(screen.getByRole('alert').textContent).toContain('Falta el token');
    expect(screen.queryByLabelText('Contraseña nueva')).toBeNull();
  });

  it('valida la contraseña y las dos coincidencias antes de llamar al API', async () => {
    mockSearch = 'token=abc123';
    const calls = mockFetch({});
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText('Contraseña nueva'), {
      target: { value: 'debil' },
    });
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), {
      target: { value: 'debil' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /Cambiar contraseña/ }).closest('form')!);

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('al menos 8 caracteres'),
    );
    expect(calls).toHaveLength(0);

    fireEvent.change(screen.getByLabelText('Contraseña nueva'), {
      target: { value: 'NuevaClave1' },
    });
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), {
      target: { value: 'OtraClave1' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /Cambiar contraseña/ }).closest('form')!);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('no coinciden'));
    expect(calls).toHaveLength(0);
  });

  it('envía el token y la contraseña cuando todo es válido', async () => {
    mockSearch = 'token=abc123';
    const calls = mockFetch({});
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText('Contraseña nueva'), {
      target: { value: 'NuevaClave1' },
    });
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), {
      target: { value: 'NuevaClave1' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /Cambiar contraseña/ }).closest('form')!);

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Contraseña actualizada'),
    );
    expect(JSON.parse(calls[0]!.body)).toEqual({ token: 'abc123', password: 'NuevaClave1' });
  });
});
