'use client';

import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { getField, getRoute } from '@/features/fields/fieldService';
import {
  buildSmoothCoveragePathForLeaflet,
  swathsToCoverageLines,
} from '@/features/coverage/leafletSmoothCoveragePath';
import { SmoothPathOptions } from '@/features/coverage/smoothCoveragePath';
import {
  buildHeadlandCoverageRings,
  buildOuterBoundaryFromInnerCoordinates,
} from '@/features/coverage/headland';

const FIELD_STYLE: L.PolylineOptions = {
  color: '#f97316',
  fillColor: '#22c55e',
  fillOpacity: 0.16,
  lineCap: 'round',
  lineJoin: 'round',
  opacity: 0.95,
  smoothFactor: 0.15,
  weight: 2,
};

const STRAIGHT_PATH_STYLE: L.PolylineOptions = {
  color: '#2563eb',
  lineCap: 'round',
  lineJoin: 'round',
  opacity: 0.9,
  smoothFactor: 0.15,
  weight: 3,
};

const CURVE_PATH_STYLE: L.PolylineOptions = {
  ...STRAIGHT_PATH_STYLE,
  dashArray: '10 7',
};

const HEADLAND_PASS_STYLE: L.PolylineOptions = {
  ...STRAIGHT_PATH_STYLE,
  color: '#c026d3',
  opacity: 0.85,
  weight: 2,
};

const INNER_BOUNDARY_STYLE: L.PolylineOptions = {
  color: '#22c55e',
  dashArray: '7 5',
  fill: false,
  lineCap: 'round',
  lineJoin: 'round',
  opacity: 0.95,
  smoothFactor: 0.15,
  weight: 2,
};

export default function AreaDetailMap({ fieldId }: { fieldId: string }) {
  const map = useMap();

  useEffect(() => {
    const layer = new L.FeatureGroup();
    let cancelled = false;

    map.addLayer(layer);

    async function loadArea() {
      try {
        const [field, route] = await Promise.all([getField(fieldId), getRoute(fieldId)]);
        if (cancelled) return;

        const planningCoordinates = field.coordinates;
        const workingWidth = field.working_width;
        const outerCoordinates =
          planningCoordinates
            ? buildOuterBoundaryFromInnerCoordinates(planningCoordinates, workingWidth)
            : null;
        const displayCoordinates = outerCoordinates ?? planningCoordinates;

        layer.clearLayers();

        if (displayCoordinates && displayCoordinates.length >= 3) {
          L.polygon(
            displayCoordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
            FIELD_STYLE,
          )
            .bindTooltip(field.name, { direction: 'top' })
            .addTo(layer);
        }

        if (planningCoordinates && planningCoordinates.length >= 3) {
          L.polygon(
            planningCoordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
            INNER_BOUNDARY_STYLE,
          ).addTo(layer);
        }

        if (displayCoordinates) {
          buildHeadlandCoverageRings(displayCoordinates, workingWidth).forEach((ring) => {
            L.polyline(
              ring.map(([lng, lat]) => [lat, lng] as [number, number]),
              HEADLAND_PASS_STYLE,
            ).addTo(layer);
          });
        }

        const coverageLines = swathsToCoverageLines(route?.swaths ?? []);

        coverageLines.forEach((line) => {
          L.polyline(
            [
              [line.start.lat, line.start.lng],
              [line.end.lat, line.end.lng],
            ],
            STRAIGHT_PATH_STYLE,
          ).addTo(layer);
        });

        if (coverageLines.length >= 2) {
          const smoothPath = buildSmoothCoveragePathForLeaflet(
            map,
            coverageLines,
            getSmoothPathOptions(workingWidth),
          );

          smoothPath.connectors.forEach((connector) => {
            L.polyline(
              connector.map((point) => [point.lat, point.lng] as [number, number]),
              CURVE_PATH_STYLE,
            ).addTo(layer);
          });
        }

        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.2), { animate: true });
        }
      } catch (error) {
        console.error('Erro ao carregar area no mapa:', error);
      }
    }

    void loadArea();

    return () => {
      cancelled = true;
      map.removeLayer(layer);
    };
  }, [fieldId, map]);

  return null;
}

function getSmoothPathOptions(workingWidthMeters?: number): SmoothPathOptions {
  const implementWidth = Math.max(workingWidthMeters ?? 6, 1);

  return {
    curveResolutionMeters: Math.max(implementWidth / 12, 0.3),
    minTurningRadiusMeters: implementWidth,
  };
}
