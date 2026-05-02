'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import generateWorkingPolygon from './generateWorkingPolygon';
import { createField, calculateRoute } from '@/features/fields/fieldService';

export default function DrawControl() {
  const map = useMap();

  useEffect(() => {
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: drawnItems,
      },
      draw: {
        polygon: {
          shapeOptions: {
            color: 'red',
            weight: 3,
            fillColor: 'red',
            fillOpacity: 0.1,
            noClip: false,
            bubblingMouseEvents: true,
          },
        },
        rectangle: false,
        circle: false,
        marker: false,
        polyline: false,
        circlemarker: false,
      },
    });

    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, async (e) => {
      const event = e as L.DrawEvents.Created;

      const layer = event.layer;
      drawnItems.addLayer(layer);
      const geojson = layer.toGeoJSON();

      const coordinates: number[][] = geojson.geometry.coordinates[0];

      // marcadores nos vértices
      coordinates.forEach((coord: number[]) => {
        const [lng, lat] = coord;
        L.circleMarker([lat, lng], {
          radius: 5,
          color: 'white',
          fillColor: 'red',
          fillOpacity: 0.1,
        }).addTo(map);
      });

      // polígono de área útil de trabalho
      const areaUtil = generateWorkingPolygon(coordinates, 20);
      if (areaUtil) {
        const latlngs = areaUtil.map(([lng, lat]: number[]) => [lat, lng]);
        L.polygon(latlngs as L.LatLngExpression[], {
          color: 'chartreuse',
          weight: 2,
          fillColor: 'chartreuse',
          fillOpacity: 0.1,
        }).addTo(map);
      }

      // Integração com a API: criar campo e calcular rota
      try {
        const field = await createField({
          name: `Campo ${new Date().toISOString()}`,
          coordinates,
          working_width: 6,
          speed_kmh: 8,
          fuel_per_km: 2.5,
        });

        const route = await calculateRoute(field.id);

        if (route?.swaths?.length) {
          route.swaths.forEach((swath) => {
            const coords = swath.coordinates;
            if (!coords || coords.length < 2) return;
            const latlngs = coords.map(([lon, lat]: number[]) => [lat, lon] as [number, number]);
            L.polyline(latlngs, {
              color: '#FFD700',
              weight: 2,
              opacity: 0.85,
            }).addTo(map);
          });
        }

        console.log('Métricas da rota:', {
          total_distance_m: route.total_distance_m,
          estimated_time_min: route.estimated_time_min,
          estimated_fuel_liters: route.estimated_fuel_liters,
        });
      } catch (err) {
        console.error('Erro ao calcular rota:', err);
      }
    });

    return () => {
      map.removeControl(drawControl);
    };
  }, [map]);

  return null;
}
