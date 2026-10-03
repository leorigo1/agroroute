const LOCATION_STORAGE_KEY = 'agroroute_user_location';
const LOCATION_ERROR_STORAGE_KEY = 'agroroute_user_location_error';
export const USER_LOCATION_EVENT = 'agroroute-user-location';
export const USER_LOCATION_STATUS_EVENT = 'agroroute-user-location-status';

export interface UserLocation {
  latitude: number;
  longitude: number;
}

function getGeolocationError(error: GeolocationPositionError): Error {
  if (error.code === error.PERMISSION_DENIED) {
    return new Error('Permita o acesso à localização no navegador e tente novamente.');
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return new Error('O navegador não conseguiu determinar sua localização.');
  }

  return new Error('A localização demorou demais. Tente novamente.');
}

export function getSavedUserLocation(): UserLocation | null {
  const storedLocation = sessionStorage.getItem(LOCATION_STORAGE_KEY);
  if (!storedLocation) return null;

  const location: unknown = JSON.parse(storedLocation);
  if (
    typeof location !== 'object' ||
    location === null ||
    !('latitude' in location) ||
    !('longitude' in location) ||
    typeof location.latitude !== 'number' ||
    typeof location.longitude !== 'number' ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude)
  ) {
    throw new Error('A localização salva no navegador é inválida.');
  }

  return { latitude: location.latitude, longitude: location.longitude };
}

export function getSavedUserLocationError(): string | null {
  return sessionStorage.getItem(LOCATION_ERROR_STORAGE_KEY);
}

export function reportUserLocationError(error: unknown): Error {
  const locationError =
    error instanceof Error ? error : new Error('Não foi possível obter sua localização.');

  sessionStorage.setItem(LOCATION_ERROR_STORAGE_KEY, locationError.message);
  window.dispatchEvent(new Event(USER_LOCATION_STATUS_EVENT));
  return locationError;
}

export function requestUserLocation(): Promise<UserLocation> {
  if (!('geolocation' in navigator)) {
    return Promise.reject(new Error('Este navegador não oferece suporte à geolocalização.'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        sessionStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
        sessionStorage.removeItem(LOCATION_ERROR_STORAGE_KEY);
        window.dispatchEvent(new CustomEvent(USER_LOCATION_EVENT, { detail: location }));
        window.dispatchEvent(new Event(USER_LOCATION_STATUS_EVENT));
        resolve(location);
      },
      (error) => reject(getGeolocationError(error)),
      {
        enableHighAccuracy: true,
        maximumAge: 30_000,
        timeout: 15_000,
      },
    );
  });
}
