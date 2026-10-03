'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PREMIUM_ACCESS_UPDATED_EVENT } from '@/features/fields/fieldService';
import { getMySubscription } from '@/features/subscriptions/subscriptionService';

type AccessState = {
  premium: boolean;
  free_usage_available: boolean;
  free_usage_used: boolean;
};

export default function PremiumAccessNotice() {
  const [access, setAccess] = useState<AccessState | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await getMySubscription();
      setAccess({
        premium: response.premium === true,
        free_usage_available: response.free_usage_available === true,
        free_usage_used: response.free_usage_used === true,
      });
      setError(false);
    } catch (requestError) {
      console.error('Não foi possível consultar o acesso Premium:', requestError);
      setError(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    window.addEventListener(PREMIUM_ACCESS_UPDATED_EVENT, refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(PREMIUM_ACCESS_UPDATED_EVENT, refresh);
    };
  }, [refresh]);

  if (error) {
    return (
      <p role="status" className="text-sm text-neutral-600">
        Não foi possível consultar seu acesso Premium agora.
      </p>
    );
  }
  if (!access) return null;

  if (access.premium) {
    return (
      <p role="status" className="text-sm font-medium text-green-800">
        Premium ativo: cálculo de rotas liberado.
      </p>
    );
  }
  if (access.free_usage_available) {
    return (
      <p role="status" className="text-sm font-medium text-green-800">
        Você tem 1 uso gratuito disponível para calcular uma rota.
      </p>
    );
  }
  if (access.free_usage_used) {
    return (
      <p role="status" className="text-sm text-neutral-700">
        Seu uso gratuito foi utilizado. Assine por R$ 8,99/mês para continuar.{' '}
        <Link className="font-semibold text-green-800 underline" href="/subscription">
          Ver Premium
        </Link>
      </p>
    );
  }
  return null;
}
