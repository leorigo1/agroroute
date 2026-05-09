'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MapContainer, TileLayer } from 'react-leaflet';
import { useMap } from 'react-leaflet';
import AreaDetailMap from './AreaDetailMap';
import AreaSelectionMap from './AreaSelectionMap';
import HomeFieldsMap from './HomeFieldsMap';

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
        attribution="Tiles &copy; Esri"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />

      {/* Camada de nomes das cidades */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        opacity={0.8}
      />

      <MapResizeHandler />
      {pathname === '/' ? <HomeFieldsMap /> : null}
      {areaDetailId ? <AreaDetailMap fieldId={areaDetailId} /> : null}
      <AreaSelectionMap />
    </MapContainer>
  );
}
