'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useState } from 'react';

import { ApiError, postJson } from '../../../src/lib/api';

const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

function ResetPasswordForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = (searchParams.get('token') ?? '').trim();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!PASSWORD_RULE.test(password)) {
      setError('La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.');
      return;
    }
    if (password !== confirmation) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      await postJson('/auth/password/reset', { token, password });
      setDone(true);
      window.setTimeout(() => router.push('/login'), 2500);
    } catch (cause: unknown) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'No se pudo cambiar la contraseña. Revisa tu conexión.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div
        role="alert"
        className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        <p className="font-medium">El enlace no es válido</p>
        <p className="mt-1">
          Falta el token de recuperación. Pide un enlace nuevo desde{' '}
          <Link className="underline" href="/forgot-password">
            recuperar contraseña
          </Link>
          .
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div
        role="status"
        className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
      >
        <p className="font-medium">Contraseña actualizada</p>
        <p className="mt-1">Te llevamos al inicio de sesión para que entres con la nueva.</p>
        <Link className="mt-3 inline-block font-medium underline" href="/login">
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
      <div>
        <label className="block text-sm font-medium text-stone-700" htmlFor="password">
          Contraseña nueva
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
        />
        <p className="mt-1 text-xs text-stone-500">
          Mínimo 8 caracteres, una mayúscula y un número.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700" htmlFor="confirmation">
          Repite la contraseña
        </label>
        <input
          id="confirmation"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-emerald-700 px-4 py-2 font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage(): React.ReactElement {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1 self-start rounded-md text-sm font-medium text-stone-600 underline-offset-4 hover:text-stone-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
      >
        <span aria-hidden="true">←</span> Volver al inicio
      </Link>

      <h1 className="text-2xl font-semibold text-stone-900">Elige una contraseña nueva</h1>
      <p className="mt-2 text-sm text-stone-600">
        Por seguridad, al cambiarla se cierran todas las sesiones abiertas de tu cuenta.
      </p>

      <Suspense fallback={<p className="mt-8 text-sm text-stone-500">Comprobando el enlace…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
