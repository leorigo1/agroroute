import { getApiUrl } from '@/features/apiConfig';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type?: string;
}

export async function loginWithGoogle(credential: string): Promise<LoginResponse> {
  const res = await fetch(`${getApiUrl()}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Falha no login com Google (${res.status}): ${detail || 'erro desconhecido'}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Resposta de login com Google inválida: access_token ausente');
  }
  return data;
}

export async function login(credentials: AuthCredentials): Promise<LoginResponse> {
  const res = await fetch(`${getApiUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Falha no login (${res.status}): ${detail || 'credenciais inválidas'}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Resposta de login inválida: access_token ausente');
  }
  return data;
}

export async function register(credentials: AuthCredentials): Promise<unknown> {
  const res = await fetch(`${getApiUrl()}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Falha no registro (${res.status}): ${detail || 'erro desconhecido'}`);
  }

  return res.json();
}
