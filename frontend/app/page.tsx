import Image from 'next/image';
import Link from 'next/link';
import styles from './landing.module.css';

const benefits = [
  {
    number: '01',
    title: 'Planeje melhor',
    description: 'Defina seus talhões e organize o planejamento das operações.',
    icon: '⌖',
  },
  {
    number: '02',
    title: 'Reduza deslocamentos',
    description: 'Visualize trajetos mais eficientes dentro da área trabalhada.',
    icon: '↗',
  },
  {
    number: '03',
    title: 'Aproveite cada hectare',
    description: 'Veja a área e a rota planejada antes de ir para o campo.',
    icon: '▦',
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
    answer:
      'Sim. Cada usuário pode fazer um cálculo de rota gratuito para conhecer o planejamento do AgroRoute.',
  },
  {
    question: 'Preciso pagar para criar uma conta?',
    answer:
      'Não. Você pode criar uma conta e conhecer a plataforma antes de contratar o Premium.',
  },
  {
    question: 'O que acontece depois do teste?',
    answer:
      'Depois do cálculo gratuito, é necessária uma assinatura Premium ativa para realizar novos cálculos de rota.',
  },
  {
    question: 'Quanto custa o Premium?',
    answer: 'A assinatura Premium custa R$ 8,99 por mês.',
  },
  {
    question: 'Como faço para assinar?',
    answer:
      'Acesse sua conta, abra Minha assinatura e siga as opções de pagamento disponíveis.',
  },
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.5 10h12m-5-5 5 5-5 5" />
    </svg>
  );
}

function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <Link href="/" className={footer ? styles.footerBrand : styles.brand} aria-label="AgroRoute, início">
      <Image src="/landing-logo-mark.png" alt="" width={42} height={30} priority />
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
            <a href="#beneficios">Benefícios</a>
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
            Rotas inteligentes
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
          <p className={styles.sectionEyebrow}>Mais clareza para sua operação</p>
          <h2>Descubra quanto você pode <span>otimizar no campo.</span></h2>
          <p>
            Faça um planejamento dentro do seu talhão e veja como o AgroRoute
            ajuda a organizar o trabalho antes de chegar à lavoura.
          </p>
        </div>
        <div className={styles.benefitGrid}>
          {benefits.map((benefit) => (
            <article className={styles.benefitCard} key={benefit.number}>
              <div className={styles.benefitTop}>
                <span className={styles.benefitIcon}>{benefit.icon}</span>
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
          <p className={styles.sectionEyebrow}>Planejamento visual</p>
          <h2>Do mapa <span>para o campo.</span></h2>
          <p>
            Desenhe seus talhões, confira a área selecionada e gere rotas para
            organizar suas operações agrícolas.
          </p>
          <Link href="/register" className={styles.textLink}>
            Experimentar o AgroRoute <ArrowIcon />
          </Link>
        </div>
        <div className={styles.demoImageWrap}>
          <div className={styles.demoWindowBar}>
            <span><i /> AgroRoute · Planejamento de área</span>
            <span>Visualização de exemplo</span>
          </div>
          <Image
            src="/landing-demo-map.jpg"
            alt="Exemplo de mapa de satélite com talhões e rotas agrícolas"
            width={1600}
            height={912}
            className={styles.demoImage}
            sizes="(max-width: 900px) 100vw, 58vw"
          />
        </div>
      </section>

      <section className={styles.trial}>
        <div>
          <p className={styles.sectionEyebrow}>Um primeiro passo sem custo</p>
          <h2>Experimente antes de assinar.</h2>
          <p>
            Crie sua conta e faça um cálculo de rota gratuito para conhecer o
            planejamento do AgroRoute.
          </p>
        </div>
        <Link href="/register" className={styles.primaryButton}>
          Usar meu cálculo gratuito <ArrowIcon />
        </Link>
      </section>

      <section className={`${styles.pricing} ${styles.section}`} id="planos">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionEyebrow}>Comece no seu ritmo</p>
          <h2>Um teste para conhecer. <span>Premium para continuar.</span></h2>
          <p>
            Use o cálculo gratuito para experimentar. Depois, tenha acesso
            contínuo às ferramentas enquanto sua assinatura estiver ativa.
          </p>
        </div>
        <div className={styles.planGrid}>
          <article className={styles.planCard}>
            <p className={styles.planLabel}>Teste gratuito</p>
            <h3>1 <small>cálculo de rota</small></h3>
            <p className={styles.planDescription}>Conheça o planejamento de rotas do AgroRoute.</p>
            <ul>
              <li><span>✓</span> Um uso gratuito por usuário</li>
              <li><span>✓</span> Experimente o planejamento</li>
              <li><span>✓</span> Sem compromisso</li>
            </ul>
            <Link href="/register" className={styles.planSecondary}>
              Criar minha conta <ArrowIcon />
            </Link>
          </article>
          <article className={`${styles.planCard} ${styles.featuredPlan}`}>
            <span className={styles.recommended}>Recomendado</span>
            <p className={styles.planLabel}>AgroRoute</p>
            <h3>Premium</h3>
            <p className={styles.price}>R$ 8,99 <small>/ mês</small></p>
            <p className={styles.planDescription}>Continue usando o AgroRoute no seu dia a dia.</p>
            <ul>
              {premiumFeatures.map((feature) => (
                <li key={feature}><span>✓</span> {feature}</li>
              ))}
            </ul>
            <Link href="/register" className={styles.primaryButton}>
              Começar agora <ArrowIcon />
            </Link>
          </article>
        </div>
      </section>

      <section className={`${styles.faq} ${styles.section}`}>
        <div className={styles.sectionHeading}>
          <p className={styles.sectionEyebrow}>Dúvidas frequentes</p>
          <h2>Perguntas <span>frequentes.</span></h2>
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
        <h2>Seu próximo planejamento pode começar agora.</h2>
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
