import type { ReactNode } from 'react';
import Image from 'next/image';
import styles from './auth.module.css';

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

export default function AuthLayout({
  children,
  headingId,
}: {
  children: ReactNode;
  headingId: string;
}) {
  return (
    <main className={styles.loginShell}>
      <section className={styles.formPanel} aria-labelledby={headingId}>
        <div className={styles.formContent}>
          <AgroRouteLogo />
          {children}
        </div>
      </section>

      <aside
        className={styles.heroPanel}
        aria-label="Rotas inteligentes para um campo mais eficiente"
      >
        <Image
          src="/agroroute-login-hero-hd.webp"
          alt="Campo agrícola ao pôr do sol, com trator e rotas de precisão em verde"
          fill
          priority
          unoptimized
          sizes="(max-width: 760px) 0px, 60vw"
          className={styles.heroImage}
        />
      </aside>
    </main>
  );
}
