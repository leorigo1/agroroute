'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { useRouter } from 'next/navigation';
import {
  getField,
  getRoute,
  isAuthExpiredError,
  listFields,
} from '@/features/fields/fieldService';
import {
  buildSmoothCoveragePathForLeaflet,
  swathsToCoverageLines,
} from '@/features/coverage/leafletSmoothCoveragePath';
import {
  buildHeadlandCoverageRings,
  buildOuterBoundaryFromInnerCoordinates,
} from '@/features/coverage/headland';
import { addRouteEndpointMarkers } from '@/features/coverage/routeEndpointMarkers';
import {
  buildHeadlandAwareConnectors,
  getHeadlandSmoothPathOptions,
} from '@/features/coverage/headlandConnectors';

const FIELD_STYLE: L.PolylineOptions = {
  color: '#f97316',
  fillColor: '#22c55e',
  fillOpacity: 0.16,
  lineCap: 'round',
  lineJoin: 'round',
  opacity: 0.95,
  smoothFactor: 0.35,
  weight: 2,
};

const STRAIGHT_PATH_STYLE: L.PolylineOptions = {
  color: '#2563eb',
  lineCap: 'round',
  lineJoin: 'round',
  opacity: 0.9,
  smoothFactor: 0.35,
  weight: 2,
};

const CURVE_PATH_STYLE: L.PolylineOptions = {
  ...STRAIGHT_PATH_STYLE,
  dashArray: '10 7',
};

const HEADLAND_PASS_STYLE: L.PolylineOptions = {
  ...STRAIGHT_PATH_STYLE,
  color: '#c026d3',
  opacity: 0.85,
  weight: 1.5,
};

const INNER_BOUNDARY_STYLE: L.PolylineOptions = {
  color: '#22c55e',
  dashArray: '7 5',
  fill: false,
  lineCap: 'round',
  lineJoin: 'round',
  opacity: 0.95,
  smoothFactor: 0.35,
  weight: 2,
};

export default function HomeFieldsMap() {
  const map = useMap();
  const router = useRouter();
  const layerRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    const layer = new L.FeatureGroup();
    let cancelled = false;

    layerRef.current = layer;
    map.addLayer(layer);

    async function loadFields() {
      try {
        const fields = await listFields();
        const fieldDetails = await Promise.all(
          fields.map(async (field) => ({
            field: await getField(field.id),
            route: await getRoute(field.id),
          })),
        );

        if (cancelled) return;

        layer.clearLayers();

        fieldDetails.forEach(({ field, route }) => {
          const planningCoordinates = field.coordinates;
          const workingWidth = field.working_width;
          const coordinates =
            (planningCoordinates
              ? buildOuterBoundaryFromInnerCoordinates(planningCoordinates, workingWidth)
              : null) ??
            planningCoordinates;

          if (coordinates && coordinates.length >= 3) {
            const fieldPolygon = L.polygon(
              coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
              FIELD_STYLE,
            )
              .bindTooltip(field.name, {
                direction: 'top',
                sticky: true,
              })
              .on('click', () => {
                router.push(`/area/${field.id}`);
              })
              .addTo(layer);

            fieldPolygon.getElement()?.classList.add('cursor-pointer');

            if (planningCoordinates?.length && planningCoordinates.length >= 3) {
              L.polygon(
                planningCoordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
                INNER_BOUNDARY_STYLE,
              ).addTo(layer);
            }

            buildHeadlandCoverageRings(coordinates, workingWidth).forEach((ring) => {
              L.polyline(
                ring.map(([lng, lat]) => [lat, lng] as [number, number]),
                HEADLAND_PASS_STYLE,
              ).addTo(layer);
            });
          }

          const coverageLines = swathsToCoverageLines(route?.swaths ?? []);
          const selectField = () => {
            router.push(`/area/${field.id}`);
          };

          coverageLines.forEach((line) => {
            addClickableRouteLine(
              [
                [line.start.lat, line.start.lng],
                [line.end.lat, line.end.lng],
              ],
              layer,
              field.name,
              selectField,
              STRAIGHT_PATH_STYLE,
            );
          });
          addRouteEndpointMarkers(layer, coverageLines);

          if (coverageLines.length >= 2) {
            const connectors = coordinates
              ? buildHeadlandAwareConnectors(
                  map,
                  coverageLines,
                  coordinates,
                  planningCoordinates ?? null,
                  workingWidth,
                )
              : buildSmoothCoveragePathForLeaflet(
                  map,
                  coverageLines,
                  getHeadlandSmoothPathOptions(workingWidth),
                ).connectors;

            connectors.forEach((connector) => {
              addClickableRouteLine(
                connector.map((point) => [point.lat, point.lng] as [number, number]),
                layer,
                field.name,
                selectField,
                CURVE_PATH_STYLE,
              );
            });
          }
        });

        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.2), { animate: true });
        }
      } catch (error) {
        if (cancelled) return;

        if (isAuthExpiredError(error)) {
          router.replace('/login');
          return;
        }

        console.error('Erro ao carregar talhoes da home:', error);
      }
    }

    void loadFields();

    return () => {
      cancelled = true;
      map.removeLayer(layer);
    };
  }, [map, router]);

  return null;
}

function addClickableRouteLine(
  points: L.LatLngExpression[],
  layer: L.LayerGroup,
  fieldName: string,
  onSelect: () => void,
  style: L.PolylineOptions,
) {
  const routeLine = L.polyline(points, style)
    .bindTooltip(fieldName, {
      direction: 'top',
      sticky: true,
    })
    .on('click', onSelect)
    .addTo(layer);

  routeLine.getElement()?.classList.add('cursor-pointer');

  const hitArea = L.polyline(points, {
    color: style.color,
    interactive: true,
    opacity: 0,
    weight: 18,
  })
    .bindTooltip(fieldName, {
      direction: 'top',
      sticky: true,
    })
    .on('click', onSelect)
    .addTo(layer);

  hitArea.getElement()?.classList.add('cursor-pointer');
}
