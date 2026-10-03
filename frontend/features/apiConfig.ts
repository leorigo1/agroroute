const DEVELOPMENT_API_URL = 'http://localhost:8000/api';
const PRODUCTION_API_URL = '/api';

export function getApiUrl(): string {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!configuredApiUrl) {
    return process.env.NODE_ENV === 'production'
      ? PRODUCTION_API_URL
      : DEVELOPMENT_API_URL;
  }

  return configuredApiUrl.replace(/\/+$/, '');
}
