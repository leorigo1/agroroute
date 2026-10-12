'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    fbq?: (command: 'track', event: 'PageView') => void;
  }
}

export default function MetaPixelPageView() {
  const pathname = usePathname();

  useEffect(() => {
    window.fbq?.('track', 'PageView');
  }, [pathname]);

  return null;
}
