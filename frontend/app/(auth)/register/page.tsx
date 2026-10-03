'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthLayout from '../AuthLayout';
import styles from '../auth.module.css';
import { register } from '@/features/auth/authService';

function MailIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="4" width="15" height="12" rx="2" />
      <path d="m3.5 5.5 6.5 5 6.5-5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3.5" y="8.5" width="13" height="9" rx="2" />
      <path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5M10 12v2" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2 10s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" />
      <circle cx="10" cy="10" r="2.2" />
      {hidden ? <path d="m3 17 14-14" /> : null}
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.5 10h12m-5-5 5 5-5 5" />
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('As senhas nao coincidem.');
      return;
    }

    setLoading(true);

    try {
      await register({ email, password });
      router.replace('/login');
    } catch (err) {
      console.error(err);
      setError('Nao foi possivel criar a conta. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout headingId="register-heading">
      <header className={styles.intro}>
        <h1 id="register-heading">Crie sua conta</h1>
        <p>Comece a gerenciar seus talhões e rotas de forma inteligente.</p>
      </header>

      <form className={styles.loginForm} onSubmit={handleSubmit}>
        <label className={styles.field} htmlFor="email">
          <span className={styles.visuallyHidden}>E-mail</span>
          <span className={styles.fieldIcon}>
            <MailIcon />
          </span>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="E-mail"
            autoComplete="email"
            required
            disabled={loading}
          />
        </label>

        <label className={styles.field} htmlFor="password">
          <span className={styles.visuallyHidden}>Senha</span>
          <span className={styles.fieldIcon}>
            <LockIcon />
          </span>
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Senha (mínimo de 6 caracteres)"
            autoComplete="new-password"
            minLength={6}
            required
            disabled={loading}
          />
          <button
            className={styles.passwordToggle}
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={showPassword}
            disabled={loading}
          >
            <EyeIcon hidden={showPassword} />
          </button>
        </label>

        <label className={styles.field} htmlFor="confirm">
          <span className={styles.visuallyHidden}>Confirmar senha</span>
          <span className={styles.fieldIcon}>
            <LockIcon />
          </span>
          <input
            id="confirm"
            name="confirm"
            type={showPassword ? 'text' : 'password'}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Confirmar senha"
            autoComplete="new-password"
            minLength={6}
            required
            disabled={loading}
          />
          <button
            className={styles.passwordToggle}
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? 'Ocultar senhas' : 'Mostrar senhas'}
            aria-pressed={showPassword}
            disabled={loading}
          >
            <EyeIcon hidden={showPassword} />
          </button>
        </label>

        {error ? (
          <p className={styles.errorMessage} role="alert">
            {error}
          </p>
        ) : null}

        <button className={styles.submitButton} type="submit" disabled={loading}>
          {loading ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Criando...
            </>
          ) : (
            <>
              Criar conta
              <ArrowIcon />
            </>
          )}
        </button>
      </form>

      <footer className={styles.footer}>
        <p>
          Já tem uma conta?{' '}
          <Link href="/login" className={styles.registerLink}>
            Entrar
          </Link>
        </p>
        <p>
          Ao continuar, você concorda com nossos
          <br />
          <span className={styles.legalText}>Termos de Serviço e Política de Privacidade</span>
        </p>
      </footer>
    </AuthLayout>
  );
}
