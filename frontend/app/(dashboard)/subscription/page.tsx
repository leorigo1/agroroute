'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  cancelSubscription,
  getMySubscription,
  MySubscriptionResponse,
  pauseSubscription,
  reactivateSubscription,
  Subscription,
  SubscriptionStatus,
} from '@/features/subscriptions/subscriptionService';
import SubscriptionCardForm from '@/features/subscriptions/SubscriptionCardForm';

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  PENDING: 'Pendente',
  ACTIVE: 'Ativa',
  PAUSED: 'Pausada',
  CANCELED: 'Cancelada',
  PAST_DUE: 'Pagamento pendente',
};

function formatDate(value: string | null): string {
  if (!value) return 'Ainda não informado';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refreshSubscription = useCallback(async () => {
    setError('');
    try {
      const response: MySubscriptionResponse = await getMySubscription();
      setSubscription(response.subscription);
    } catch (requestError) {
      console.error('Não foi possível consultar a assinatura:', requestError);
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível consultar a assinatura.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSubscription();
  }, [refreshSubscription]);

  async function performAction(
    action: () => Promise<MySubscriptionResponse>,
    successMessage: string,
  ) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const response = await action();
      setSubscription(response.subscription);
      setSuccess(successMessage);
    } catch (requestError) {
      console.error('Não foi possível alterar a assinatura:', requestError);
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível alterar a assinatura.',
      );
    } finally {
      setBusy(false);
    }
  }

  const canCreate = !subscription || subscription.status === 'CANCELED';

  return (
    <main className="mx-auto w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-700">
            Assinatura
          </p>
          <h1 className="mt-2 text-2xl font-bold text-neutral-950">AgroRoute Premium</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Mais recursos para planejar e acompanhar o trabalho no campo.
          </p>
        </div>
        {subscription ? (
          <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-800">
            {STATUS_LABELS[subscription.status]}
          </span>
        ) : null}
      </div>

      <div className="mt-6 rounded-xl bg-neutral-50 p-5">
        <p className="text-3xl font-bold text-neutral-950">
          R$ 8,99
          <span className="ml-2 text-base font-medium text-neutral-600">/mês</span>
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          Cobrança recorrente processada pelo Mercado Pago. O acesso Premium só é liberado após
          confirmação do pagamento.
        </p>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-neutral-600" role="status">
          Consultando sua assinatura...
        </p>
      ) : null}

      {!loading && subscription ? (
        <dl className="mt-6 grid gap-4 rounded-xl border border-neutral-200 p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Plano</dt>
            <dd className="mt-1 font-semibold text-neutral-900">{subscription.plan}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Valor</dt>
            <dd className="mt-1 font-semibold text-neutral-900">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: subscription.currency,
              }).format(subscription.amount)}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Início</dt>
            <dd className="mt-1 font-semibold text-neutral-900">
              {formatDate(subscription.start_date)}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Próxima cobrança</dt>
            <dd className="mt-1 font-semibold text-neutral-900">
              {formatDate(subscription.next_payment_date)}
            </dd>
          </div>
          {subscription.canceled_at ? (
            <div>
              <dt className="text-neutral-500">Cancelada em</dt>
              <dd className="mt-1 font-semibold text-neutral-900">
                {formatDate(subscription.canceled_at)}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {!loading && canCreate ? (
        <SubscriptionCardForm onCreated={() => void refreshSubscription()} />
      ) : null}

      {!loading && subscription?.status === 'PENDING' ? (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Aguardando a confirmação do primeiro pagamento pelo Mercado Pago. Atualize o status para
          consultar novamente.
        </div>
      ) : null}
      {!loading && subscription?.status === 'PAST_DUE' ? (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          O último pagamento não foi confirmado. O acesso Premium está suspenso até uma cobrança
          aprovada.
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-5 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="mt-5 text-sm text-green-800">
          {success}
        </p>
      ) : null}

      {!loading && subscription && subscription.status !== 'CANCELED' ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void refreshSubscription()}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
          >
            Atualizar status
          </button>
          {subscription.status === 'ACTIVE' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void performAction(pauseSubscription, 'Assinatura pausada.')}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
            >
              {busy ? 'Processando...' : 'Pausar assinatura'}
            </button>
          ) : null}
          {subscription.status === 'PAUSED' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void performAction(reactivateSubscription, 'Reativação solicitada.')}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
            >
              {busy ? 'Processando...' : 'Reativar assinatura'}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Deseja cancelar sua assinatura Premium?')) {
                void performAction(cancelSubscription, 'Assinatura cancelada.');
              }
            }}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {busy ? 'Processando...' : 'Cancelar assinatura'}
          </button>
        </div>
      ) : null}
    </main>
  );
}
