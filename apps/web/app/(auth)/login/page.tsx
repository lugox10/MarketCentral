'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { ApiError, postJson } from '../../../src/lib/api';

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await postJson('/auth/login', { email, password });
      router.push('/dashboard');
    } catch (cause: unknown) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'No se pudo iniciar sesión. Revisa tu conexión.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold text-stone-900">Iniciar sesión</h1>
      <p className="mt-2 text-sm text-stone-600">Accede al panel de tu negocio en MarketCentral.</p>

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

        <div>
          <label className="block text-sm font-medium text-stone-700" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className="mt-6 text-sm text-stone-600">
        ¿No tienes cuenta?{' '}
        <Link className="font-medium text-emerald-700 underline" href="/register">
          Crear una cuenta
        </Link>
      </p>
    </main>
  );
}
