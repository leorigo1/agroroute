'use client';

import dynamic from 'next/dynamic';
import LoadingScreen from '@/components/common/loadingScreen';

const Map = dynamic(() => import('@/features/map/map'), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

export default function DashboardMap() {
  return <Map />;
}
