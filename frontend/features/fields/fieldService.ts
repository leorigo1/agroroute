const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
  coordinates: number[][];
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

export async function createField(payload: CreateFieldPayload): Promise<FieldResponse> {
  const res = await fetch(`${API_URL}/fields/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Falha ao criar campo (${res.status}): ${detail}`);
  }
  return res.json();
}

export async function calculateRoute(fieldId: string | number): Promise<RouteResponse> {
  const res = await fetch(`${API_URL}/fields/${fieldId}/calculate`, {
    method: 'POST',
    headers: getHeaders(),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Falha ao calcular rota (${res.status}): ${detail}`);
  }
  return res.json();
}
