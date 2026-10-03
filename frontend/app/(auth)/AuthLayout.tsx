import type { ReactNode } from 'react';
import Image from 'next/image';
import HeroCarousel from './HeroCarousel';
import styles from './auth.module.css';

function AgroRouteLogo() {
  return (
    <Image
      src="/agroroute-brand-logo.png"
      alt="AgroRoute"
      width={586}
      height={356}
      priority
      unoptimized
      className={styles.logo}
    />
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

      <aside className={styles.heroPanel} aria-label="Tecnologia e geolocalização no campo">
        <HeroCarousel />
        <div className={styles.heroContent}>
          <div className={styles.heroCopy}>
            <h2 className={styles.heroTitle}>
              Rotas inteligentes
              <br />
              para um campo <span>mais eficiente.</span>
            </h2>
            <p className={styles.heroDescription}>
              Tecnologia e geolocalização para otimizar
              <br />o seu trabalho no campo.
            </p>
          </div>

          <ul className={styles.heroBenefits} aria-label="Benefícios do AgroRoute">
            <li className={styles.heroBenefit}>
              <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <circle cx="15" cy="17" r="10.5" />
                <circle cx="15" cy="17" r="5.5" />
                <path d="M15 17 24 8m-4 0h4v4M15 17l-2.5 6" />
              </svg>
              <span className={styles.benefitText}>
                <strong>Mais precisão</strong>
                <span>na aplicação</span>
              </span>
            </li>

            <li className={styles.heroBenefit}>
              <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M8 5h13v22H8a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
                <path d="M21 10h5l3 4v10h-8M11 9h7v8h-7zM24 27v-3m-16 3v-3" />
              </svg>
              <span className={styles.benefitText}>
                <strong>Menos custos</strong>
                <span>com insumos e combustível</span>
              </span>
            </li>

            <li className={styles.heroBenefit}>
              <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M5 27h23M8 24v-7h5v7m3 0V12h5v12m3 0V6h5v18M7 12l7-5 5 3 8-7m-5 0h5v5" />
              </svg>
              <span className={styles.benefitText}>
                <strong>Mais produtividade</strong>
                <span>no seu talhão</span>
              </span>
            </li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
