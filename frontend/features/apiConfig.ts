const DEVELOPMENT_API_URL = 'http://localhost:8000';

export function getApiUrl(): string {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!configuredApiUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_API_URL precisa apontar para a API publicada.');
    }

    return DEVELOPMENT_API_URL;
  }

  return configuredApiUrl.replace(/\/+$/, '');
}
