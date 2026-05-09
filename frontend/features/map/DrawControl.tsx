'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import { createField, calculateRoute } from '@/features/fields/fieldService';
import {
  buildSmoothCoveragePathForLeaflet,
  swathsToCoverageLines,
} from '@/features/coverage/leafletSmoothCoveragePath';
import {
  CoverageLine,
  LatLngPoint,
  SmoothPathOptions,
} from '@/features/coverage/smoothCoveragePath';
import {
  buildHeadlandCoverageRings,
  buildInnerBoundaryCoordinates,
  getHeadlandWidthMeters,
  isConnectorInsideHeadlandZone,
} from '@/features/coverage/headland';

const DEFAULT_WORKING_WIDTH_METERS = 6;

const STRAIGHT_PATH_STYLE: L.PolylineOptions = {
  color: '#2563eb',
  lineCap: 'round',
  lineJoin: 'round',
  opacity: 0.9,
  weight: 3,
};

const CURVE_PATH_STYLE: L.PolylineOptions = {
  ...STRAIGHT_PATH_STYLE,
  dashArray: '10 7',
};

const INNER_BOUNDARY_STYLE: L.PolylineOptions = {
  color: '#22c55e',
  dashArray: '7 5',
  fill: false,
  lineCap: 'round',
  lineJoin: 'round',
  opacity: 0.95,
  weight: 2,
};

const HEADLAND_PASS_STYLE: L.PolylineOptions = {
  ...STRAIGHT_PATH_STYLE,
  color: '#c026d3',
  opacity: 0.85,
  weight: 2,
};

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
      if (geojson.geometry.type !== 'Polygon') return;

      const coordinates: number[][] = geojson.geometry.coordinates[0];
      const innerBoundaryCoordinates = buildInnerBoundaryCoordinates(
        coordinates,
        DEFAULT_WORKING_WIDTH_METERS,
      );

      if (!innerBoundaryCoordinates) {
        console.error('Bordadura interna consumiu toda a area desenhada.');
      } else {
        L.polygon(
          innerBoundaryCoordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
          INNER_BOUNDARY_STYLE,
        ).addTo(map);
      }

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

      // Integração com a API: criar campo e calcular rota
      try {
        if (!innerBoundaryCoordinates) {
          throw new Error('A bordadura consumiu toda a area desenhada.');
        }

        const field = await createField({
          name: `Campo ${new Date().toISOString()}`,
          coordinates: innerBoundaryCoordinates,
          working_width: 6,
          speed_kmh: 8,
          fuel_per_km: 2.5,
        });

        const route = await calculateRoute(field.id);

        if (route?.swaths?.length) {
          const coverageLines = swathsToCoverageLines(route.swaths);

          buildHeadlandCoverageRings(
            coordinates,
            DEFAULT_WORKING_WIDTH_METERS,
          ).forEach((ring) => {
            L.polyline(
              ring.map(([lng, lat]) => [lat, lng] as [number, number]),
              HEADLAND_PASS_STYLE,
            ).addTo(map);
          });

          coverageLines.forEach((line) => {
            L.polyline(
              [
                [line.start.lat, line.start.lng],
                [line.end.lat, line.end.lng],
              ],
              STRAIGHT_PATH_STYLE,
            ).addTo(map);
          });

          if (coverageLines.length >= 2) {
            const connectors = innerBoundaryCoordinates
              ? buildConstrainedConnectors(
                  map,
                  coverageLines,
                  coordinates,
                  innerBoundaryCoordinates,
                  DEFAULT_WORKING_WIDTH_METERS,
                )
              : buildSmoothCoveragePathForLeaflet(
                  map,
                  coverageLines,
                  getSmoothPathOptions(DEFAULT_WORKING_WIDTH_METERS),
                ).connectors;

            connectors.forEach((connector) => {
              L.polyline(
                connector.map((point) => [point.lat, point.lng] as [number, number]),
                CURVE_PATH_STYLE,
              ).addTo(map);
            });
          }
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

function getSmoothPathOptions(workingWidthMeters: number): SmoothPathOptions {
  const implementWidth = Math.max(workingWidthMeters, 1);
  const headlandWidth = getHeadlandWidthMeters(implementWidth);

  return {
    curveResolutionMeters: Math.max(implementWidth / 8, 0.5),
    minTurningRadiusMeters: headlandWidth / 2,
  };
}

function buildConstrainedConnectors(
  map: L.Map,
  coverageLines: CoverageLine[],
  outerBoundaryCoordinates: number[][],
  innerBoundaryCoordinates: number[][] | null,
  workingWidthMeters: number,
): LatLngPoint[][] {
  const implementWidth = Math.max(workingWidthMeters, 1);
  const headlandWidth = getHeadlandWidthMeters(implementWidth);
  const resolution = Math.max(implementWidth / 8, 0.5);
  const radiusCandidates = [
    headlandWidth / 2,
    headlandWidth * 0.45,
    headlandWidth * 0.4,
    headlandWidth * 0.35,
    headlandWidth * 0.3,
  ];
  const connectors: LatLngPoint[][] = [];

  for (let index = 0; index < coverageLines.length - 1; index += 1) {
    const currentLine = coverageLines[index];
    const nextLine = coverageLines[index + 1];
    const validConnector = radiusCandidates
      .map((radius) =>
        buildSmoothCoveragePathForLeaflet(map, [currentLine, nextLine], {
          curveResolutionMeters: resolution,
          minTurningRadiusMeters: Math.max(radius, implementWidth * 0.35),
        }).connectors[0],
      )
      .find(
        (connector) =>
          connector?.length &&
          isConnectorInsideHeadlandZone(
            connector,
            outerBoundaryCoordinates,
            innerBoundaryCoordinates,
          ),
      );

    if (validConnector) {
      connectors.push(validConnector);
    }
  }

  return connectors;
}
