'use client';

import { useEffect, useState } from 'react';
import {
  getSavedUserLocationError,
  reportUserLocationError,
  requestUserLocation,
  USER_LOCATION_STATUS_EVENT,
} from './userLocation';

export default function LocateMeButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const syncLocationStatus = () => {
      const error = getSavedUserLocationError();
      if (error) {
        setMessage(error);
        setIsError(true);
      } else {
        setMessage('');
        setIsError(false);
      }
    };

    syncLocationStatus();
    window.addEventListener(USER_LOCATION_STATUS_EVENT, syncLocationStatus);
    return () => window.removeEventListener(USER_LOCATION_STATUS_EVENT, syncLocationStatus);
  }, []);

  async function handleLocate() {
    setLoading(true);
    setMessage('');
    setIsError(false);

    try {
      await requestUserLocation();
      setMessage('Mapa centralizado na sua localização.');
    } catch (error) {
      const locationError = reportUserLocationError(error);
      console.error('Não foi possível obter a localização do usuário:', locationError);
      setMessage(locationError.message);
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleLocate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded border border-green-700 px-3 py-2 text-sm font-semibold text-green-800 transition hover:bg-green-50 disabled:cursor-wait disabled:opacity-60"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <circle cx="10" cy="10" r="6.5" />
          <circle cx="10" cy="10" r="2" />
          <path d="M10 1v2m0 14v2M1 10h2m14 0h2" />
        </svg>
        {loading ? 'Localizando...' : 'Minha localização'}
      </button>
      {message ? (
        <span
          role={isError ? 'alert' : 'status'}
          className={`basis-full text-xs ${isError ? 'text-red-700' : 'text-green-800'}`}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
