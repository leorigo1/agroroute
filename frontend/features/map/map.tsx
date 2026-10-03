'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MapContainer, TileLayer } from 'react-leaflet';
import { useMap } from 'react-leaflet';
import AreaDetailMap from './AreaDetailMap';
import AreaSelectionMap from './AreaSelectionMap';
import HomeFieldsMap from './HomeFieldsMap';
import UserLocationMap from './UserLocationMap';

import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

function MapResizeHandler() {
  const map = useMap();
  const pathname = usePathname();

  useEffect(() => {
    const invalidateMapSize = () => {
      map.invalidateSize();
    };

    invalidateMapSize();
    const firstFrame = window.requestAnimationFrame(invalidateMapSize);
    const timeout = window.setTimeout(invalidateMapSize, 250);

    window.addEventListener('resize', invalidateMapSize);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.clearTimeout(timeout);
      window.removeEventListener('resize', invalidateMapSize);
    };
  }, [map, pathname]);

  return null;
}

export default function Map() {
  const pathname = usePathname();
  const areaDetailMatch = pathname.match(/^\/area\/([^/]+)$/);
  const areaDetailId = areaDetailMatch?.[1];
  const cartoApiKey = process.env.NEXT_PUBLIC_CARTO_API_KEY;
  const cartoKeyQuery = cartoApiKey ? `?key=${encodeURIComponent(cartoApiKey)}` : '';

  return (
    <MapContainer
      center={[-25.792934, -53.684604]}
      zoom={13}
      minZoom={10}
      maxZoom={18}
      dragging={true}
      scrollWheelZoom={true}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution="Tiles &copy; Esri &mdash; Sources: Esri, Maxar, Earthstar Geographics"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
      <TileLayer
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={`https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png${cartoKeyQuery}`}
        opacity={0.85}
      />

      <MapResizeHandler />
      <UserLocationMap />
      {pathname === '/' ? <HomeFieldsMap /> : null}
      {areaDetailId ? <AreaDetailMap fieldId={areaDetailId} /> : null}
      <AreaSelectionMap />
    </MapContainer>
  );
}
