'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';

import { ApiError, postJson } from '../../../src/lib/api';

export default function ForgotPasswordPage(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await postJson('/auth/password/forgot', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (cause: unknown) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'No se pudo enviar la solicitud. Revisa tu conexión.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1 self-start rounded-md text-sm font-medium text-stone-600 underline-offset-4 hover:text-stone-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
      >
        <span aria-hidden="true">←</span> Volver al inicio
      </Link>

      <h1 className="text-2xl font-semibold text-stone-900">Recuperar contraseña</h1>
      <p className="mt-2 text-sm text-stone-600">
        Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.
        El enlace caduca en una hora.
      </p>

      {sent ? (
        <div
          role="status"
          className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <p className="font-medium">Revisa tu correo</p>
          <p className="mt-1">
            Si <span className="font-medium">{email}</span> tiene una cuenta, te enviamos un enlace
            para restablecer la contraseña. Si no llega en unos minutos, revisa la carpeta de spam.
          </p>
        </div>
      ) : (
        <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
          <div>
            <label className="block text-sm font-medium text-stone-700" htmlFor="email">
              Correo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
            {loading ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>
      )}

      <p className="mt-6 text-sm text-stone-600">
        <Link className="font-medium text-emerald-700 underline" href="/login">
          Volver a iniciar sesión
        </Link>
      </p>
    </main>
  );
}
