'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  cancelSubscription,
  createPixPayment,
  getMySubscription,
  MySubscriptionResponse,
  pauseSubscription,
  PixPayment,
  reactivateSubscription,
  Subscription,
  SubscriptionStatus,
} from '@/features/subscriptions/subscriptionService';
import SubscriptionCardForm from '@/features/subscriptions/SubscriptionCardForm';
import PremiumAccessNotice from '@/features/subscriptions/PremiumAccessNotice';
import { PREMIUM_ACCESS_UPDATED_EVENT } from '@/features/fields/fieldService';

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

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix' | null>(null);
  const [cpf, setCpf] = useState('');
  const [pixPayment, setPixPayment] = useState<PixPayment | null>(null);

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
      window.dispatchEvent(new Event(PREMIUM_ACCESS_UPDATED_EVENT));
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
  const canPayWithPix =
    canCreate ||
    (subscription?.payment_method === 'pix' &&
      ['PENDING', 'ACTIVE', 'PAST_DUE'].includes(subscription.status));

  async function generatePixPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const response = await createPixPayment(cpf);
      setSubscription(response.subscription);
      setPixPayment(response.pix);
      setPaymentMethod('pix');
      window.dispatchEvent(new Event(PREMIUM_ACCESS_UPDATED_EVENT));
      setSuccess(
        'PIX gerado. O acesso Premium será liberado após a confirmação do pagamento.',
      );
    } catch (requestError) {
      console.error('Não foi possível gerar o PIX:', requestError);
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível gerar o pagamento PIX.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyPixCode() {
    if (!pixPayment?.qr_code) return;
    try {
      await navigator.clipboard.writeText(pixPayment.qr_code);
      setSuccess('Código PIX copiado.');
    } catch (copyError) {
      console.error('Não foi possível copiar o código PIX:', copyError);
      setError('Não foi possível copiar automaticamente. Selecione e copie o código PIX.');
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:border-green-700 hover:bg-green-50 hover:text-green-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="h-4 w-4"
        >
          <path
            d="M19 12H5m0 0 6 6m-6-6 6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Voltar ao mapa
      </Link>
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
      <div className="mt-4">
        <PremiumAccessNotice />
      </div>

      <div className="mt-6 rounded-xl bg-neutral-50 p-5">
        <p className="text-3xl font-bold text-neutral-950">
          R$ 8,99
          <span className="ml-2 text-base font-medium text-neutral-600">/mês</span>
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          No cartão, a cobrança é recorrente. No PIX, o pagamento é manual a cada mês. O acesso
          Premium é liberado após a confirmação do pagamento.
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
            <dt className="text-neutral-500">
              {subscription.payment_method === 'pix' ? 'Acesso válido até' : 'Próxima cobrança'}
            </dt>
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
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                paymentMethod === 'card'
                  ? 'border-green-700 bg-green-50 text-green-900'
                  : 'border-neutral-300 text-neutral-800 hover:bg-neutral-50'
              }`}
            >
              Cartão recorrente
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('pix')}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                paymentMethod === 'pix'
                  ? 'border-green-700 bg-green-50 text-green-900'
                  : 'border-neutral-300 text-neutral-800 hover:bg-neutral-50'
              }`}
            >
              PIX mensal
            </button>
          </div>
          {paymentMethod === 'card' ? (
            <SubscriptionCardForm onCreated={() => void refreshSubscription()} />
          ) : null}
        </div>
      ) : null}
      {!loading && canPayWithPix && (paymentMethod === 'pix' || !canCreate) ? (
        <form onSubmit={generatePixPayment} className="mt-6 space-y-4">
          <p className="text-sm text-neutral-700">
            Gere um QR Code PIX de R$ 8,99. Cada pagamento confirmado libera 1 mês de Premium; a
            renovação é manual.
          </p>
          <label
            htmlFor="premium-pix-cpf"
            className="block text-sm font-medium text-neutral-800"
          >
            CPF do pagador
            <input
              id="premium-pix-cpf"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={cpf}
              onChange={(event) => setCpf(event.target.value.replace(/\D/g, '').slice(0, 11))}
              pattern="[0-9]{11}"
              minLength={11}
              maxLength={11}
              required
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={busy || cpf.length !== 11}
            className="rounded-lg bg-green-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? 'Gerando PIX...' : 'Gerar / consultar QR Code PIX'}
          </button>
        </form>
      ) : null}
      {pixPayment ? (
        <section className="mt-6 grid justify-items-center gap-4 rounded-xl border border-neutral-200 p-5">
          <h2 className="text-lg font-semibold text-neutral-950">Pague com PIX</h2>
          {pixPayment.qr_code_base64 ? (
            <Image
              src={`data:image/png;base64,${pixPayment.qr_code_base64}`}
              alt="QR Code PIX para pagamento do AgroRoute Premium"
              width={224}
              height={224}
              unoptimized
              className="h-56 w-56"
            />
          ) : null}
          {pixPayment.qr_code ? (
            <div className="w-full space-y-2">
              <label
                htmlFor="premium-pix-code"
                className="block text-sm font-medium text-neutral-800"
              >
                PIX copia e cola
              </label>
              <textarea
                id="premium-pix-code"
                readOnly
                value={pixPayment.qr_code}
                className="min-h-24 w-full resize-y rounded-lg border border-neutral-300 p-3 text-xs text-neutral-700"
              />
              <button
                type="button"
                onClick={() => void copyPixCode()}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                Copiar código PIX
              </button>
            </div>
          ) : null}
          {pixPayment.expiration_date ? (
            <p className="text-sm text-neutral-600">
              Válido até {formatDateTime(pixPayment.expiration_date)}
            </p>
          ) : null}
          {pixPayment.ticket_url ? (
            <a
              href={pixPayment.ticket_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-green-800 underline"
            >
              Abrir detalhes do pagamento
            </a>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void refreshSubscription()}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
          >
            Já paguei — atualizar status
          </button>
        </section>
      ) : null}
      {!loading && subscription?.status === 'PENDING' ? (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Aguardando a confirmação do pagamento pelo Mercado Pago. Atualize o status para consultar
          novamente.
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
          {subscription.payment_method === 'card' && subscription.status === 'ACTIVE' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void performAction(pauseSubscription, 'Assinatura pausada.')}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
            >
              {busy ? 'Processando...' : 'Pausar assinatura'}
            </button>
          ) : null}
          {subscription.payment_method === 'card' && subscription.status === 'PAUSED' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void performAction(reactivateSubscription, 'Reativação solicitada.')}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
            >
              {busy ? 'Processando...' : 'Reativar assinatura'}
            </button>
          ) : null}
          {subscription.payment_method === 'card' ? (
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
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
