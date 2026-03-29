'use client';

import dynamic from 'next/dynamic';

const Map = dynamic(() => import('@/features/map/map'), {
  ssr: false,
});

export default function MapWrapper() {
  return <Map />;
}
