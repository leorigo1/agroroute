'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FieldResponse, getField, getRoute, RouteResponse } from '@/features/fields/fieldService';

export default function AreaDetails() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const fieldId = params.id;
  const [field, setField] = useState<FieldResponse | null>(null);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadArea() {
      setIsLoading(true);
      setError(null);

      try {
        const [fieldResponse, routeResponse] = await Promise.all([
          getField(fieldId),
          getRoute(fieldId),
        ]);

        if (cancelled) return;

        setField(fieldResponse);
        setRoute(routeResponse);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar area.');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadArea();

    return () => {
      cancelled = true;
    };
  }, [fieldId]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-950">
            {field?.name ?? 'Area'}
          </h1>
          <p className="text-sm text-neutral-600">
            {isLoading
              ? 'Carregando dados da area...'
              : 'Resumo operacional da rota calculada para este talhao.'}
          </p>
          {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
        </div>

        <button
          type="button"
          onClick={() => router.replace('/')}
          className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Voltar
        </button>
      </div>

      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Metric label="Largura (m)" value={formatNumber(field?.working_width)} />
        <Metric label="Distancia (m)" value={formatNumber(route?.total_distance_m)} />
        <Metric label="Tempo (min)" value={formatNumber(route?.estimated_time_min)} />
        <Metric label="Combustivel (L)" value={formatNumber(route?.estimated_fuel_liters)} />
        <Metric label="Faixas" value={route?.swaths?.length ? String(route.swaths.length) : '-'} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs font-medium text-neutral-700">
      {label}
      <div className="mt-1 min-h-10 rounded border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-900">
        {value}
      </div>
    </div>
  );
}

function formatNumber(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';

  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
  }).format(value);
}
