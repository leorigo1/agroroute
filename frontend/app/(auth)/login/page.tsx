'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { login } from '@/features/auth/authService';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login({ email, password });
      localStorage.setItem('agroroute_token', data.access_token);
      window.dispatchEvent(new Event('agroroute-auth-change'));
      router.replace('/');
    } catch (err) {
      console.error(err);
      setError('E-mail ou senha invalidos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <section className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-950">Entrar</h1>
          <p className="text-sm text-neutral-600">
            Acesse sua conta para visualizar e gerenciar seus talhoes.
          </p>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <label className="text-xs font-medium text-neutral-700">
            E-mail
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-green-700"
              placeholder="seu@email.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="text-xs font-medium text-neutral-700">
            Senha
            <div className="mt-1 flex rounded border border-neutral-300 bg-white transition-within focus-within:border-green-700">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-w-0 flex-1 rounded bg-transparent px-3 py-2 text-sm text-neutral-900 outline-none"
                placeholder="Sua senha"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="border-l border-neutral-200 px-3 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100"
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </label>

          <button
            type="submit"
            className="mt-2 rounded bg-green-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <Link href="/register" className="font-medium text-green-700 transition hover:text-green-800">
            Criar conta
          </Link>
          <span className="text-neutral-500">AgroRoute</span>
        </div>
      </section>
    </main>
  );
}
