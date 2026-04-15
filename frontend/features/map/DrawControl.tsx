'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import generateWorkingPolygon from './generateWorkingPolygon';

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

    // evento quando cria algo
    map.on(L.Draw.Event.CREATED, (e) => {
      const event = e as L.DrawEvents.Created;

      const layer = event.layer;
      drawnItems.addLayer(layer);
      const geojson = layer.toGeoJSON();

      //Desenha os pontos do polígono
      geojson.geometry.coordinates[0].map((coord: number[]) => {
        console.log('Coordenada:', coord);
        const [lng, lat] = coord;
        L.circleMarker([lat, lng], {
          radius: 5,
          color: 'white',
          fillColor: 'red',
          fillOpacity: 0.1,
        }).addTo(map);
      })

      // Gerar o polígono da area util de trabalho
      const areaUtil = generateWorkingPolygon(geojson.geometry.coordinates[0], 20);
      if (areaUtil) {
        const latlngs = areaUtil.map(([lng, lat]: number[]) => [lat, lng]);
        L.polygon(latlngs, {
          color: 'chartreuse',
          weight: 2,
          fillColor: 'chartreuse',
          fillOpacity: 0.1,
        }).addTo(map);
      }




    });

    // cleanup
    return () => {
      map.removeControl(drawControl);
    };
  }, [map]);

  return null;
}





