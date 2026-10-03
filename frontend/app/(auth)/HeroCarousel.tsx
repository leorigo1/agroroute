'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import styles from './auth.module.css';

const heroImages = [
  '/agroroute-login-hero-background.jpg',
  '/agroroute-login-hero-2.jpg',
  '/agroroute-login-hero-3.jpg',
];

export default function HeroCarousel() {
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveImage((currentImage) => (currentImage + 1) % heroImages.length);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className={styles.heroCarousel}>
      {heroImages.map((src, index) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          priority={index === 0}
          loading={index === 0 ? undefined : 'eager'}
          unoptimized
          sizes="(max-width: 760px) 100vw, 50vw"
          className={`${styles.heroImage} ${activeImage === index ? styles.heroImageActive : ''}`}
        />
      ))}
      <div className={styles.heroIndicators} role="group" aria-label="Imagens da seção">
        {heroImages.map((src, index) => (
          <button
            key={src}
            type="button"
            className={`${styles.heroIndicator} ${activeImage === index ? styles.heroIndicatorActive : ''}`}
            aria-label={`Exibir imagem ${index + 1}`}
            aria-pressed={activeImage === index}
            onClick={() => setActiveImage(index)}
          />
        ))}
      </div>
    </div>
  );
}
