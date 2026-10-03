import { getApiUrl } from '@/features/apiConfig';
import { buildApiError, getHeaders } from '@/features/fields/fieldService';

export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'CANCELED' | 'PAST_DUE';

export interface Subscription {
  id: number;
  status: SubscriptionStatus;
  plan: string;
  payment_method: 'card' | 'pix';
  amount: number;
  currency: string;
  start_date: string | null;
  next_payment_date: string | null;
  canceled_at: string | null;
}

export interface PixPayment {
  payment_id: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
  expiration_date: string | null;
}

export interface PixPaymentResponse {
  subscription: Subscription;
  pix: PixPayment;
}

export interface MySubscriptionResponse {
  subscription: Subscription | null;
  premium?: boolean;
  free_usage_available?: boolean;
  free_usage_used?: boolean;
}

async function subscriptionRequest<T>(
  path: string,
  action: string,
  method = 'GET',
  body?: Record<string, string>,
): Promise<T> {
  const response = await fetch(`${getApiUrl()}/subscriptions${path}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw await buildApiError(response, action);
  }
  return response.json() as Promise<T>;
}

export function getMySubscription(): Promise<MySubscriptionResponse> {
  return subscriptionRequest('/me', 'consultar assinatura');
}

export function createSubscription(cardTokenId: string): Promise<MySubscriptionResponse> {
  return subscriptionRequest('', 'criar assinatura', 'POST', { card_token_id: cardTokenId });
}

export function createPixPayment(cpf: string): Promise<PixPaymentResponse> {
  return subscriptionRequest('/pix', 'gerar PIX', 'POST', { cpf });
}

export function cancelSubscription(): Promise<MySubscriptionResponse> {
  return subscriptionRequest('/me/cancel', 'cancelar assinatura', 'POST');
}

export function pauseSubscription(): Promise<MySubscriptionResponse> {
  return subscriptionRequest('/me/pause', 'pausar assinatura', 'POST');
}

export function reactivateSubscription(): Promise<MySubscriptionResponse> {
  return subscriptionRequest('/me/reactivate', 'reativar assinatura', 'POST');
}
