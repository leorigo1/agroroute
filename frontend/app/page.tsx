import Image from 'next/image';
import Link from 'next/link';
import styles from './landing.module.css';

const benefits = [
  {
    number: '01',
    title: 'Planeje melhor',
    description: 'Defina seus talhões e organize o planejamento das operações.',
    icon: 'pin',
  },
  {
    number: '02',
    title: 'Reduza deslocamentos',
    description: 'Visualize trajetos mais eficientes dentro da área trabalhada.',
    icon: 'fuel',
  },
  {
    number: '03',
    title: 'Aproveite cada hectare',
    description: 'Veja a área e a rota planejada antes de ir para o campo.',
    icon: 'trend',
  },
];

const premiumFeatures = [
  'Cálculo de rotas nos talhões',
  'Organização das áreas',
  'Cálculo de área em hectares',
  'Visualização no mapa',
  'Recursos de geolocalização',
  'Uso contínuo enquanto ativo',
];

const questions = [
  {
    question: 'O AgroRoute possui teste gratuito?',
    answer: 'Sim. Cada usuário possui 1 uso gratuito para experimentar o planejamento de rotas.',
  },
  {
    question: 'Preciso pagar para criar uma conta?',
    answer: 'Não. Você pode criar sua conta e utilizar seu teste gratuito antes de decidir pela assinatura.',
  },
  {
    question: 'O que acontece depois do teste?',
    answer: 'Após o teste gratuito, você poderá assinar o Premium para continuar utilizando o AgroRoute.',
  },
  {
    question: 'Posso utilizar o AgroRoute novamente sem assinar?',
    answer: 'O teste gratuito é limitado a 1 uso por usuário. Para continuar utilizando os recursos Premium, é necessário possuir uma assinatura ativa.',
  },
  {
    question: 'Como faço para assinar?',
    answer: 'Após o teste gratuito, basta acessar a área de assinatura e escolher o plano Premium.',
  },
];

const freeTrialSteps = [
  { number: '01', icon: 'user', title: 'Crie sua conta' },
  { number: '02', icon: 'sparkle', title: 'Faça seu primeiro planejamento' },
  { number: '03', icon: 'crown', title: 'Continue com o Premium', detail: 'Gostou? Assine o Premium e continue utilizando o AgroRoute.' },
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.5 10h12m-5-5 5 5-5 5" />
    </svg>
  );
}

function LineIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {name === 'pin' ? (
        <>
          <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </>
      ) : null}
      {name === 'fuel' ? (
        <>
          <path d="M4 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h14M7 7h6v5H7zM16 8h2l2 2v7a2 2 0 0 1-4 0v-4" />
        </>
      ) : null}
      {name === 'trend' ? (
        <>
          <path d="m3 17 6-6 4 4 8-9" />
          <path d="M15 6h6v6" />
        </>
      ) : null}
      {name === 'user' ? (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20M19 8v6M16 11h6" />
        </>
      ) : null}
      {name === 'sparkle' ? (
        <>
          <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
          <path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" />
        </>
      ) : null}
      {name === 'crown' ? (
        <path d="m3 7 5 4 4-7 4 7 5-4-2 12H5L3 7Z" />
      ) : null}
    </svg>
  );
}

function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <Link href="/" className={footer ? styles.footerBrand : styles.brand} aria-label="AgroRoute, início">
      <Image
        src="/landing-logo-mark.png"
        alt=""
        width={42}
        height={30}
        priority
        unoptimized
      />
      <span>AgroRoute</span>
    </Link>
  );
}

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="hero-heading">
        <div className={styles.heroImage} aria-hidden="true" />
        <header className={styles.header}>
          <Brand />
          <nav className={styles.nav} aria-label="Navegação principal">
            <a href="#como-funciona">Como funciona</a>
            <Link href="/login" className={styles.loginLink}>Entrar</Link>
          </nav>
        </header>

        <div className={styles.heroContent}>
          <div className={styles.eyebrow}>
            <span />
            Agricultura de precisão
          </div>
          <h1 id="hero-heading">
            Rotas
            <br />
            <span>inteligentes</span>
            <br />
            para um campo
            <br />
            mais <span>eficiente.</span>
          </h1>
          <p className={styles.heroText}>
            Planeje o trabalho dentro dos seus talhões, reduza deslocamentos e
            aproveite melhor cada hectare com tecnologia e geolocalização.
          </p>
          <div className={styles.heroActions}>
            <div>
              <Link href="/register" className={styles.primaryButton}>
                Começar gratuitamente <ArrowIcon />
              </Link>
              <p className={styles.buttonNote}>1 cálculo de rota gratuito · Sem compromisso</p>
            </div>
            <a href="#como-funciona" className={styles.secondaryButton}>
              Ver como funciona
            </a>
          </div>
          <p className={styles.heroFootnote}>
            Experimente seu primeiro planejamento de rota.
          </p>
        </div>

        <div className={styles.heroSignals} aria-label="Recursos do AgroRoute">
          <div className={styles.signalCard}>
            <span className={styles.signalIcon}>↗</span>
            <span><small>Planejamento</small><strong>Rota no talhão</strong></span>
          </div>
          <div className={`${styles.signalCard} ${styles.signalArea}`}>
            <span className={styles.signalIcon}>▦</span>
            <span><small>Área selecionada</small><strong>Em hectares</strong></span>
          </div>
          <div className={`${styles.signalCard} ${styles.signalTravel}`}>
            <span className={styles.signalIcon}>⌖</span>
            <span>Menos deslocamento</span>
          </div>
          <div className={`${styles.signalCard} ${styles.signalProductivity}`}>
            <span className={styles.signalIcon}>⌁</span>
            <span>Mais eficiência no campo</span>
          </div>
        </div>
        <a className={styles.scrollHint} href="#beneficios">Conheça o AgroRoute <span>↓</span></a>
      </section>

      <section className={`${styles.benefits} ${styles.section}`} id="beneficios">
        <div className={styles.sectionHeading}>
          <h2>Descubra quanto você pode otimizar no campo.</h2>
          <p>
            Use seu teste gratuito para planejar uma rota dentro do seu talhão e veja na prática como o AgroRoute pode ajudar a reduzir deslocamentos e tornar suas operações mais eficientes.
          </p>
        </div>
        <div className={styles.benefitGrid}>
          {benefits.map((benefit) => (
            <article className={styles.benefitCard} key={benefit.number}>
              <div className={styles.benefitTop}>
                <span className={styles.benefitIcon}><LineIcon name={benefit.icon} /></span>
                <span className={styles.benefitNumber}>{benefit.number}</span>
              </div>
              <h3>{benefit.title}</h3>
              <p>{benefit.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.demo} ${styles.section}`} id="como-funciona">
        <div className={styles.demoCopy}>
          <h2>Do mapa para o campo.</h2>
          <p>
            Desenhe seus talhões, visualize as áreas e gere rotas inteligentes para suas operações agrícolas.
          </p>
        </div>
        <div className={styles.demoImageWrap}>
          <div className={styles.demoWindowBar}>
            <span className={styles.windowDots} aria-hidden="true"><i /><i /><i /></span>
            <span className={styles.addressBar}>app.agroroute.com.br/mapa</span>
          </div>
          <Image
            src="/landing-demo-map.jpg"
            alt="Exemplo de mapa de satélite com talhões e rotas agrícolas"
            width={1600}
            height={912}
            className={styles.demoImage}
            sizes="(max-width: 900px) 100vw, 58vw"
            unoptimized
          />
        </div>
        <Link href="/register" className={styles.primaryButton}>
          Experimentar o AgroRoute <ArrowIcon />
        </Link>
      </section>

      <section className={styles.demoCta}>
        <h2>Veja o AgroRoute funcionando na prática.</h2>
        <p>
          Não fique apenas imaginando. Faça seu primeiro planejamento gratuitamente e descubra como suas operações podem ser mais eficientes.
        </p>
        <Link href="/register" className={styles.primaryButton}>
          Fazer meu teste gratuito <ArrowIcon />
        </Link>
        <small>1 uso gratuito para experimentar.</small>
      </section>

      <section className={styles.trial}>
        <div className={styles.trialIntro}>
          <span className={styles.trialBadge}>1 uso gratuito</span>
          <h2>Experimente antes de assinar</h2>
          <p>Você tem 1 uso gratuito para conhecer o AgroRoute e experimentar o planejamento de rotas.</p>
        </div>
        <ol className={styles.trialSteps}>
          {freeTrialSteps.map((step) => (
            <li key={step.number}>
              <span className={styles.stepNumber}>{step.number}</span>
              <span className={styles.stepIcon}><LineIcon name={step.icon} /></span>
              <h3>{step.title}</h3>
              {step.detail ? <p>{step.detail}</p> : null}
            </li>
          ))}
        </ol>
        <Link href="/register" className={styles.primaryButton}>
          Usar meu teste gratuito <ArrowIcon />
        </Link>
      </section>

      <section className={`${styles.pricing} ${styles.section}`} id="planos">
        <div className={styles.sectionHeading}>
          <h2>Continue usando o AgroRoute no seu dia a dia.</h2>
          <p>
            Depois do seu teste gratuito, tenha acesso contínuo às ferramentas do AgroRoute através da assinatura Premium.
          </p>
        </div>
        <div className={styles.planGrid}>
          <article className={styles.planCard}>
            <p className={styles.planLabel}>Teste gratuito</p>
            <h3>1 uso</h3>
            <ul>
              <li><span>✓</span> 1 uso gratuito</li>
              <li><span>✓</span> Conheça o planejamento de rotas</li>
              <li><span>✓</span> Experimente o sistema</li>
            </ul>
            <Link href="/register" className={styles.planSecondary}>
              Usar meu teste gratuito
            </Link>
          </article>
          <article className={`${styles.planCard} ${styles.featuredPlan}`}>
            <span className={styles.recommended}>Recomendado</span>
            <p className={styles.planLabel}>Premium</p>
            <h3>Uso contínuo</h3>
            <ul>
              {premiumFeatures.map((feature) => (
                <li key={feature}><span>✓</span> {feature}</li>
              ))}
            </ul>
            <p className={styles.planDescription}>Acesso contínuo enquanto a assinatura estiver ativa.</p>
            <Link href="/register" className={styles.primaryButton}>
              Continuar com Premium <ArrowIcon />
            </Link>
          </article>
        </div>
      </section>

      <section className={`${styles.faq} ${styles.section}`}>
        <div className={styles.sectionHeading}>
          <h2>Perguntas frequentes</h2>
        </div>
        <div className={styles.faqList}>
          {questions.map(({ question, answer }) => (
            <details key={question} className={styles.faqItem}>
              <summary>{question}<span aria-hidden="true">+</span></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <p className={styles.sectionEyebrow}>AgroRoute</p>
        <h2>Seu próximo planejamento pode começar <span>agora.</span></h2>
        <p>
          Experimente gratuitamente e descubra uma forma mais inteligente de
          planejar suas operações no campo.
        </p>
        <Link href="/register" className={styles.primaryButton}>
          Começar meu teste gratuito <ArrowIcon />
        </Link>
        <small>1 cálculo de rota gratuito · Depois, continue com o Premium</small>
      </section>

      <footer className={styles.footer}>
        <Brand footer />
        <div className={styles.footerLinks}>
          <Link href="/login">Entrar</Link>
          <Link href="/register">Criar conta</Link>
          <Link href="/map">Acessar plataforma</Link>
        </div>
        <p>© {new Date().getFullYear()} AgroRoute</p>
      </footer>
    </main>
  );
}
