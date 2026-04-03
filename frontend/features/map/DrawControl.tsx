'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';

export default function DrawControl() {
  const map = useMap();

  useEffect(() => {
    // grupo onde ficam os desenhos
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // controle de desenho
    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: drawnItems,
      },
      draw: {
        polygon: {
          shapeOptions: {
            color: 'coral',
            weight: 3,
            fillColor: 'red',
            fillOpacity: 0.2,
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

    // evento quando cria algo
    map.on(L.Draw.Event.CREATED, (e) => {
      const event = e as L.DrawEvents.Created;

      const layer = event.layer;
      drawnItems.addLayer(layer);

      const geojson = layer.toGeoJSON();
      console.log('GeoJSON:', geojson);
    });

    // cleanup
    return () => {
      map.removeControl(drawControl);
    };
  }, [map]);

  return null;
}
