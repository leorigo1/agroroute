'use client';

import { MapContainer, TileLayer } from 'react-leaflet';
import DrawControl from './DrawControl';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

export default function Map() {
  return (
    <MapContainer
      center={[-25.792934, -53.684604]}
      zoom={13}
      minZoom={10}
      maxZoom={18}
      dragging={true}
      scrollWheelZoom={true}
      style={{ height: '100dvh', width: '100dvw' }}
    >
      <TileLayer
        attribution="Tiles &copy; Esri"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />

      <DrawControl />
    </MapContainer>
  );
}
