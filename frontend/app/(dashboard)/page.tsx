'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const Map = dynamic(() => import('@/features/map/map'), {
  ssr: false,
});

export default function MapWrapper() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('agroroute_token');
    if (!token) {
      router.replace('/login');
    }
  }, [router]);

  return <Map />;
}
