'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { createSubscription } from './subscriptionService';

interface MercadoPagoCardForm {
  getCardFormData: () => { token?: string };
  unmount: () => void;
}

interface MercadoPagoInstance {
  cardForm: (options: Record<string, unknown>) => MercadoPagoCardForm;
}

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options: { locale: string }) => MercadoPagoInstance;
  }
}

export default function SubscriptionCardForm({ onCreated }: { onCreated: () => void }) {
  const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
  const [sdkReady, setSdkReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!publicKey || !sdkReady || !window.MercadoPago) return;

    const mercadoPago = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
    const cardForm = mercadoPago.cardForm({
      amount: '8.99',
      autoMount: true,
      form: {
        id: 'premium-card-form',
        cardholderName: { id: 'premium-cardholder-name' },
        cardholderEmail: { id: 'premium-cardholder-email' },
        cardNumber: { id: 'premium-card-number', placeholder: 'Número do cartão' },
        expirationMonth: { id: 'premium-expiration-month', placeholder: 'MM' },
        expirationYear: { id: 'premium-expiration-year', placeholder: 'AA' },
        securityCode: { id: 'premium-security-code', placeholder: 'CVV' },
        identificationType: { id: 'premium-identification-type' },
        identificationNumber: { id: 'premium-identification-number' },
        issuer: { id: 'premium-issuer' },
        installments: { id: 'premium-installments' },
        token: { id: 'premium-card-token' },
        paymentMethodId: { id: 'premium-payment-method' },
      },
      callbacks: {
        onFormMounted: (error: Error | undefined) => {
          if (error) {
            setIsError(true);
            setMessage('Não foi possível inicializar o formulário de cartão.');
          }
        },
        onSubmit: async (event: Event) => {
          event.preventDefault();
          setProcessing(true);
          setMessage('');
          setIsError(false);
          try {
            const { token } = cardForm.getCardFormData();
            if (!token) {
              throw new Error('O Mercado Pago não gerou o token do cartão.');
            }
            await createSubscription(token);
            setMessage(
              'Solicitação recebida. A assinatura ficará pendente até a confirmação do pagamento.',
            );
            onCreated();
          } catch (error) {
            console.error('Não foi possível criar a assinatura Premium:', error);
            setIsError(true);
            setMessage(
              error instanceof Error ? error.message : 'Não foi possível processar a assinatura.',
            );
          } finally {
            setProcessing(false);
          }
        },
      },
    });

    return () => cardForm.unmount();
  }, [onCreated, publicKey, sdkReady]);

  if (!publicKey) {
    return (
      <p className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        O pagamento ainda não está configurado. Defina NEXT_PUBLIC_MP_PUBLIC_KEY na Vercel para
        habilitar o formulário.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onReady={() => setSdkReady(true)}
        onError={() => {
          setIsError(true);
          setMessage('Não foi possível carregar o formulário do Mercado Pago.');
        }}
      />
      <form
        id="premium-card-form"
        className="space-y-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <label
          className="block text-sm font-medium text-neutral-800"
          htmlFor="premium-cardholder-name"
        >
          Nome no cartão
          <input
            id="premium-cardholder-name"
            autoComplete="cc-name"
            required
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label
          className="block text-sm font-medium text-neutral-800"
          htmlFor="premium-cardholder-email"
        >
          E-mail do titular
          <input
            id="premium-cardholder-email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium text-neutral-800" htmlFor="premium-card-number">
          Número do cartão
          <input
            id="premium-card-number"
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            required
            className="mt-1 min-h-10 w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label
            className="block text-sm font-medium text-neutral-800"
            htmlFor="premium-expiration-month"
          >
            Mês de validade
            <input
              id="premium-expiration-month"
              autoComplete="cc-exp-month"
              required
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
          <label
            className="block text-sm font-medium text-neutral-800"
            htmlFor="premium-expiration-year"
          >
            Ano de validade
            <input
              id="premium-expiration-year"
              autoComplete="cc-exp-year"
              required
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label
            className="block text-sm font-medium text-neutral-800"
            htmlFor="premium-security-code"
          >
            Código de segurança
            <input
              id="premium-security-code"
              type="text"
              inputMode="numeric"
              autoComplete="cc-csc"
              required
              className="mt-1 min-h-10 w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
          <label
            className="block text-sm font-medium text-neutral-800"
            htmlFor="premium-identification-type"
          >
            Tipo de documento
            <select
              id="premium-identification-type"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Selecione
              </option>
              <option value="CPF">CPF</option>
            </select>
          </label>
        </div>
        <label
          className="block text-sm font-medium text-neutral-800"
          htmlFor="premium-identification-number"
        >
          CPF
          <input
            id="premium-identification-number"
            inputMode="numeric"
            autoComplete="off"
            required
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <select id="premium-issuer" hidden aria-hidden="true" tabIndex={-1} />
        <select id="premium-installments" hidden aria-hidden="true" tabIndex={-1} />
        <input id="premium-card-token" type="hidden" />
        <input id="premium-payment-method" type="hidden" />

        {message ? (
          <p
            role={isError ? 'alert' : 'status'}
            className={`text-sm ${isError ? 'text-red-700' : 'text-green-800'}`}
          >
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!sdkReady || processing}
          className="w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white transition hover:bg-green-800 disabled:cursor-wait disabled:opacity-60"
        >
          {processing ? 'Processando...' : 'Assinar por R$ 8,99/mês'}
        </button>
      </form>
    </div>
  );
}
