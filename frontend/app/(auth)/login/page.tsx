'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { login, loginWithGoogle, LoginResponse } from '@/features/auth/authService';
import { reportUserLocationError, requestUserLocation } from '@/features/map/userLocation';
import AuthLayout from '../AuthLayout';
import styles from '../auth.module.css';

type GoogleCredentialResponse = {
  credential?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme: 'filled_black';
              size: 'large';
              text: 'continue_with';
              shape: 'rect';
              width: number;
            },
          ) => void;
          cancel: () => void;
        };
      };
    };
  }
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const completeLogin = useCallback((data: LoginResponse) => {
    localStorage.setItem('agroroute_token', data.access_token);
    window.dispatchEvent(new Event('agroroute-auth-change'));
    router.replace('/');
    void requestUserLocation().catch((locationError: unknown) => {
      const reportedError = reportUserLocationError(locationError);
      console.error('Não foi possível obter a localização após o login:', reportedError);
    });
  }, [router]);

  const handleGoogleCredential = useCallback(async (credential: string) => {
    setError('');
    setGoogleLoading(true);
    try {
      const data = await loginWithGoogle(credential);
      completeLogin(data);
    } catch (loginError) {
      console.error('Não foi possível entrar com Google:', loginError);
      setError('Não foi possível entrar com Google. Tente novamente.');
    } finally {
      setGoogleLoading(false);
    }
  }, [completeLogin]);

  useEffect(() => {
    const buttonHost = googleButtonRef.current;
    const googleIdentity = window.google?.accounts.id;
    if (!googleClientId || !googleScriptReady || !buttonHost || !googleIdentity) return;

    buttonHost.replaceChildren();
    googleIdentity.initialize({
      client_id: googleClientId,
      callback: (response) => {
        if (response.credential) {
          void handleGoogleCredential(response.credential);
        } else {
          setError('O Google não retornou uma credencial válida.');
        }
      },
    });
    googleIdentity.renderButton(buttonHost, {
      theme: 'filled_black',
      size: 'large',
      text: 'continue_with',
      shape: 'rect',
      width: Math.min(buttonHost.clientWidth || 320, 400),
    });

    return () => {
      window.google?.accounts.id.cancel();
      buttonHost.replaceChildren();
    };
  }, [googleClientId, googleScriptReady, handleGoogleCredential]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login({ email, password });
      completeLogin(data);
    } catch (err) {
      console.error(err);
      setError('E-mail ou senha inválidos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout headingId="login-heading">
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
        {googleClientId ? (
          <>
            <Script
              src="https://accounts.google.com/gsi/client"
              strategy="afterInteractive"
              onReady={() => setGoogleScriptReady(true)}
              onError={() => setError('Não foi possível carregar o login do Google.')}
            />
            <div
              ref={googleButtonRef}
              className={styles.googleButtonContainer}
              aria-label="Continuar com Google"
              aria-busy={googleLoading}
            />
            {googleLoading ? (
              <p className={styles.googleLoading} role="status">
                Entrando com Google...
              </p>
            ) : null}
          </>
        ) : (
          <button
            className={styles.providerButton}
            type="button"
            disabled
            title="Configure NEXT_PUBLIC_GOOGLE_CLIENT_ID"
          >
            <span>Login com Google não configurado</span>
          </button>
        )}
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
    </AuthLayout>
  );
}
