import { getApiUrl } from '@/features/apiConfig';

export const PREMIUM_ACCESS_UPDATED_EVENT = 'agroroute-premium-access-updated';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly action: string,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface CreateFieldPayload {
  name: string;
  coordinates: number[][];
  working_width: number;
  speed_kmh: number;
  fuel_lph: number;
}

export interface FieldResponse {
  id: string | number;
  name: string;
  coordinates?: number[][];
  working_width: number;
  speed_kmh?: number;
  fuel_lph: number;
  [key: string]: unknown;
}

export interface RouteResponse {
  swaths: number[][][];
  total_distance_m?: number;
  estimated_time_min?: number;
  estimated_fuel_liters?: number;
  original_coordinates?: number[][];
  planning_coordinates?: number[][];
  working_width?: number;
  [key: string]: unknown;
}

export function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('agroroute_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

export async function buildApiError(res: Response, action: string): Promise<Error> {
  if (res.status === 401) {
    clearStoredAuth();
    return new ApiError(res.status, action, 'Sessao expirada. Faça login novamente.');
  }

  if (res.status === 402) {
    const payload: unknown = await res
      .clone()
      .json()
      .catch(() => null);
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'detail' in payload &&
      typeof payload.detail === 'object' &&
      payload.detail !== null &&
      'error' in payload.detail &&
      payload.detail.error === 'SUBSCRIPTION_REQUIRED'
    ) {
      if (typeof window !== 'undefined' && window.location.pathname !== '/subscription') {
        window.location.assign('/subscription');
      }
      return new ApiError(res.status, action, 'É necessário possuir uma assinatura ativa.');
    }
  }

  if (res.status === 409) {
    const payload: unknown = await res
      .clone()
      .json()
      .catch(() => null);
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'detail' in payload &&
      typeof payload.detail === 'object' &&
      payload.detail !== null &&
      'code' in payload.detail &&
      payload.detail.code === 'SUBSCRIPTION_ALREADY_ACTIVE'
    ) {
      const message =
        'message' in payload.detail && typeof payload.detail.message === 'string'
          ? payload.detail.message
          : 'Sua assinatura Premium já está ativa.';
      return new ApiError(res.status, action, message, 'SUBSCRIPTION_ALREADY_ACTIVE');
    }
  }

  const detail = await res.text().catch(() => '');
  return new ApiError(res.status, action, `Falha ao ${action} (${res.status}): ${detail}`);
}

function clearStoredAuth() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('agroroute_token');
  window.dispatchEvent(new Event('agroroute-auth-change'));
}

export function isAuthExpiredError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export async function createField(payload: CreateFieldPayload): Promise<FieldResponse> {
  const res = await fetch(`${getApiUrl()}/fields/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw await buildApiError(res, 'criar campo');
  }
  return res.json();
}

export async function calculateRoute(fieldId: string | number): Promise<RouteResponse> {
  const res = await fetch(`${getApiUrl()}/fields/${fieldId}/calculate`, {
    method: 'POST',
    headers: getHeaders(),
  });

  if (!res.ok) {
    throw await buildApiError(res, 'calcular rota');
  }
  const route = (await res.json()) as RouteResponse;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PREMIUM_ACCESS_UPDATED_EVENT));
  }
  return route;
}

export async function listFields(): Promise<FieldResponse[]> {
  const res = await fetch(`${getApiUrl()}/fields/`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!res.ok) {
    throw await buildApiError(res, 'listar talhoes');
  }
  return res.json();
}

export async function getField(fieldId: string | number): Promise<FieldResponse> {
  const res = await fetch(`${getApiUrl()}/fields/${fieldId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!res.ok) {
    throw await buildApiError(res, 'buscar talhao');
  }
  return res.json();
}

export async function getRoute(fieldId: string | number): Promise<RouteResponse | null> {
  const res = await fetch(`${getApiUrl()}/fields/${fieldId}/route`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw await buildApiError(res, 'buscar rota');
  }
  return res.json();
}
