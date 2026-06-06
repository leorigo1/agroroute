const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly action: string,
    message: string,
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
  fuel_per_km: number;
}

export interface FieldResponse {
  id: string | number;
  name: string;
  coordinates?: number[][];
  working_width: number;
  speed_kmh?: number;
  fuel_per_km?: number;
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

function getHeaders(): HeadersInit {
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

async function buildApiError(res: Response, action: string): Promise<Error> {
  if (res.status === 401) {
    clearStoredAuth();
    return new ApiError(res.status, action, 'Sessao expirada. Faça login novamente.');
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
  const res = await fetch(`${API_URL}/fields/`, {
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
  const res = await fetch(`${API_URL}/fields/${fieldId}/calculate`, {
    method: 'POST',
    headers: getHeaders(),
  });

  if (!res.ok) {
    throw await buildApiError(res, 'calcular rota');
  }
  return res.json();
}

export async function listFields(): Promise<FieldResponse[]> {
  const res = await fetch(`${API_URL}/fields/`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!res.ok) {
    throw await buildApiError(res, 'listar talhoes');
  }
  return res.json();
}

export async function getField(fieldId: string | number): Promise<FieldResponse> {
  const res = await fetch(`${API_URL}/fields/${fieldId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!res.ok) {
    throw await buildApiError(res, 'buscar talhao');
  }
  return res.json();
}

export async function getRoute(fieldId: string | number): Promise<RouteResponse | null> {
  const res = await fetch(`${API_URL}/fields/${fieldId}/route`, {
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
