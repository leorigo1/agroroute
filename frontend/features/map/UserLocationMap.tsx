'use client';

import { useCallback, useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { getSavedUserLocation, USER_LOCATION_EVENT, UserLocation } from './userLocation';

function isUserLocation(value: unknown): value is UserLocation {
  if (typeof value !== 'object' || value === null) return false;
  if (!('latitude' in value) || !('longitude' in value)) return false;

  return (
    typeof value.latitude === 'number' &&
    Number.isFinite(value.latitude) &&
    typeof value.longitude === 'number' &&
    Number.isFinite(value.longitude)
  );
}

export default function UserLocationMap() {
  const map = useMap();
  const markerRef = useRef<L.CircleMarker | null>(null);

  const showLocation = useCallback(
    (location: UserLocation) => {
      const center: L.LatLngExpression = [location.latitude, location.longitude];

      map.flyTo(center, Math.max(map.getZoom(), 15), { duration: 1.2 });
      markerRef.current?.remove();
      markerRef.current = L.circleMarker(center, {
        color: '#ffffff',
        fillColor: '#22c55e',
        fillOpacity: 1,
        radius: 8,
        weight: 3,
      })
        .bindTooltip('Sua localização', { direction: 'top' })
        .addTo(map);
    },
    [map],
  );

  useEffect(() => {
    let savedLocation: UserLocation | null;
    try {
      savedLocation = getSavedUserLocation();
    } catch (error) {
      console.error('Não foi possível ler a localização salva:', error);
      savedLocation = null;
    }

    if (savedLocation) showLocation(savedLocation);

    const handleLocation = (event: Event) => {
      if (!(event instanceof CustomEvent) || !isUserLocation(event.detail)) {
        console.error('O navegador enviou uma localização inválida ao mapa.');
        return;
      }

      showLocation(event.detail);
    };

    window.addEventListener(USER_LOCATION_EVENT, handleLocation);

    return () => {
      window.removeEventListener(USER_LOCATION_EVENT, handleLocation);
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [showLocation]);

  return null;
}
