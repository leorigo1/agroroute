'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { login } from '@/features/auth/authService';
import styles from './login.module.css';

function AgroRouteLogo() {
  return (
    <div className={styles.logo} aria-label="AgroRoute">
      <svg viewBox="0 0 48 48" aria-hidden="true" className={styles.logoMark}>
        <path
          d="M5 41 19.2 9.3a5.2 5.2 0 0 1 9.6 0L43 41h-9.1L24 19.7 14.1 41H5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="5.2"
          strokeLinejoin="round"
        />
        <path
          d="m16.7 31.7 7.3-5 7.3 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        Agro<span className={styles.logoAccent}>Route</span>
      </span>
    </div>
  );
}

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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.72-.06-1.42-.18-2.1H12v3.97h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.24-2.52c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.13H3.06v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.88a6.02 6.02 0 0 1 0-3.76v-2.6H3.06a10 10 0 0 0 0 8.96l3.35-2.6Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.99c1.47 0 2.79.5 3.83 1.52l2.87-2.87C16.96 2.99 14.7 2 12 2a10 10 0 0 0-8.94 5.52l3.35 2.6C7.2 7.75 9.4 5.99 12 5.99Z"
      />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.7 5.1A18 18 0 0 0 15.2 3.7l-.56 1.15a16.7 16.7 0 0 0-5.28 0L8.8 3.7a18 18 0 0 0-4.5 1.4C1.45 9.35.68 13.4 1.06 17.4a18.2 18.2 0 0 0 5.53 2.8l1.2-1.95a11.8 11.8 0 0 1-1.9-.92l.47-.36c3.67 1.7 7.65 1.7 11.28 0l.48.36a12 12 0 0 1-1.91.92l1.2 1.95a18.1 18.1 0 0 0 5.53-2.8c.45-4.63-.77-8.65-3.27-12.3ZM8.9 14.9c-1.08 0-1.96-.99-1.96-2.2s.86-2.2 1.96-2.2 1.98.99 1.96 2.2c0 1.21-.86 2.2-1.96 2.2Zm6.2 0c-1.08 0-1.96-.99-1.96-2.2s.86-2.2 1.96-2.2 1.98.99 1.96 2.2c0 1.21-.86 2.2-1.96 2.2Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.37 12.54c.02 2.1 1.84 2.8 1.86 2.81-.02.05-.29 1-.95 1.98-.57.85-1.17 1.7-2.1 1.72-.92.02-1.22-.55-2.28-.55-1.05 0-1.39.53-2.25.57-.9.04-1.6-.92-2.18-1.77-1.18-1.7-2.08-4.8-.87-6.88a3.37 3.37 0 0 1 2.85-1.73c.89-.02 1.72.6 2.27.6.55 0 1.58-.74 2.66-.63.45.02 1.72.18 2.53 1.37-.07.04-1.51.88-1.54 2.51Zm-1.75-5.01c.48-.58.8-1.38.71-2.18-.69.03-1.53.46-2.03 1.04-.45.52-.84 1.33-.73 2.1.77.06 1.57-.39 2.05-.96Z"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="6" r="3" />
      <path d="M3.5 17v-1.5a6.5 6.5 0 0 1 13 0V17h-13Z" />
    </svg>
  );
}

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
      setError('E-mail ou senha inválidos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.loginShell}>
      <section className={styles.formPanel} aria-labelledby="login-heading">
        <div className={styles.formContent}>
          <AgroRouteLogo />

          <header className={styles.intro}>
            <h1 id="login-heading">Bem-vindo de volta</h1>
            <p>
              Acesse sua conta para gerenciar seus talhões
              <br className={styles.desktopBreak} /> e rotas de forma inteligente.
            </p>
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

            <label className={styles.remember}>
              <input type="checkbox" defaultChecked />
              <span>Lembrar de mim</span>
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
                placeholder="Senha"
                autoComplete="current-password"
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

            {error ? (
              <p className={styles.errorMessage} role="alert">
                {error}
              </p>
            ) : null}

            <button className={styles.submitButton} type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowIcon />
                </>
              )}
            </button>
          </form>

          <div className={styles.divider} aria-hidden="true">
            <span />
            <span>ou</span>
            <span />
          </div>

          <div className={styles.providers} aria-label="Outras formas de entrar">
            <button
              className={styles.providerButton}
              type="button"
              disabled
              title="Integração não disponível"
            >
              <span className={`${styles.providerIcon} ${styles.googleIcon}`}>
                <GoogleIcon />
              </span>
              <span>Continuar com Google</span>
            </button>
            <button
              className={styles.providerButton}
              type="button"
              disabled
              title="Integração não disponível"
            >
              <span className={`${styles.providerIcon} ${styles.discordIcon}`}>
                <DiscordIcon />
              </span>
              <span>Continuar com Discord</span>
            </button>
            <button
              className={styles.providerButton}
              type="button"
              disabled
              title="Integração não disponível"
            >
              <span className={`${styles.providerIcon} ${styles.appleIcon}`}>
                <AppleIcon />
              </span>
              <span>Continuar com Apple</span>
            </button>
            <button
              className={`${styles.providerButton} ${styles.ssoButton}`}
              type="button"
              disabled
              title="Integração não disponível"
            >
              <span className={`${styles.providerIcon} ${styles.ssoIcon}`}>
                <UserIcon />
              </span>
              <span>Login único (SSO)</span>
            </button>
          </div>

          <footer className={styles.footer}>
            <p>
              Ainda não tem uma conta?{' '}
              <Link href="/register" className={styles.registerLink}>
                Criar conta
              </Link>
            </p>
            <p>
              Ao continuar, você concorda com nossos
              <br />
              <span className={styles.legalText}>Termos de Serviço e Política de Privacidade</span>
            </p>
          </footer>
        </div>
      </section>

      <aside
        className={styles.heroPanel}
        aria-label="Rotas inteligentes para um campo mais eficiente"
      >
        <Image
          src="/agroroute-login-hero.png"
          alt="Campo agrícola ao pôr do sol, com trator e rotas de precisão em verde"
          fill
          priority
          sizes="(max-width: 760px) 0px, 60vw"
          className={styles.heroImage}
        />
      </aside>
    </main>
  );
}
