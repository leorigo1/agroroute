'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNewAreaSelection } from './NewAreaSelectionContext';
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

const HEADLAND_PASS_STYLE: L.PolylineOptions = {
  ...STRAIGHT_PATH_STYLE,
  color: '#c026d3',
  opacity: 0.85,
  weight: 2,
};

export default function AreaSelectionMap() {
  const map = useMap();
  const {
    cancelToken,
    isSelecting,
    resetToken,
    route,
    selection,
    setSelection,
    undoToken,
    workingWidthMeters,
  } = useNewAreaSelection();
  const pointsRef = useRef<L.LatLng[]>([]);
  const isClosedRef = useRef(false);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  const syncSelection = useCallback(() => {
    const points = pointsRef.current;
    const coordinates = points.map((point) => [point.lng, point.lat]);

    if (isClosedRef.current && points[0]) {
      coordinates.push([points[0].lng, points[0].lat]);
    }

    setSelection({
      coordinates,
      isClosed: isClosedRef.current,
      pointCount: points.length,
    });
  }, [setSelection]);

  const redrawSelection = useCallback(() => {
    const drawnItems = drawnItemsRef.current;
    const points = pointsRef.current;
    if (!drawnItems) return;

    drawnItems.clearLayers();

    if (points.length >= 2) {
      const path = isClosedRef.current ? [...points, points[0]] : points;

      if (isClosedRef.current) {
        L.polygon(path, {
          color: '#f97316',
          fillColor: '#22c55e',
          fillOpacity: 0.22,
          lineCap: 'round',
          lineJoin: 'round',
          opacity: 0.95,
          smoothFactor: 0.15,
          weight: 3,
        }).addTo(drawnItems);

        const innerBoundaryCoordinates = buildInnerBoundaryCoordinates(
          pointsToCoordinates(points, true),
          workingWidthMeters,
        );

        if (innerBoundaryCoordinates) {
          L.polygon(
            innerBoundaryCoordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
            INNER_BOUNDARY_STYLE,
          ).addTo(drawnItems);
        }
      } else {
        L.polyline(path, {
          color: '#f97316',
          lineCap: 'round',
          lineJoin: 'round',
          opacity: 0.95,
          smoothFactor: 0.15,
          weight: 3,
        }).addTo(drawnItems);
      }
    }

    points.forEach((point, index) => {
      L.circleMarker(point, {
        color: index === 0 ? '#16a34a' : '#ffffff',
        fillColor: index === 0 ? '#16a34a' : '#f97316',
        fillOpacity: 1,
        interactive: false,
        radius: index === 0 ? 7 : 5,
        weight: 2,
      }).addTo(drawnItems);
    });
  }, [workingWidthMeters]);

  useEffect(() => {
    const drawnItems = new L.FeatureGroup();
    const routeLayer = new L.LayerGroup();

    drawnItemsRef.current = drawnItems;
    routeLayerRef.current = routeLayer;
    map.addLayer(drawnItems);
    map.addLayer(routeLayer);

    return () => {
      map.removeLayer(drawnItems);
      map.removeLayer(routeLayer);
    };
  }, [map]);

  useEffect(() => {
    pointsRef.current = [];
    isClosedRef.current = false;
    drawnItemsRef.current?.clearLayers();
    setSelection(null);
  }, [resetToken, setSelection]);

  useEffect(() => {
    pointsRef.current = [];
    isClosedRef.current = false;
    drawnItemsRef.current?.clearLayers();
    setSelection(null);
  }, [cancelToken, setSelection]);

  useEffect(() => {
    if (!undoToken) return;

    if (isClosedRef.current) {
      isClosedRef.current = false;
    } else {
      pointsRef.current = pointsRef.current.slice(0, -1);
    }

    redrawSelection();
    syncSelection();
  }, [redrawSelection, syncSelection, undoToken]);

  useEffect(() => {
    if (!isClosedRef.current) return;

    redrawSelection();
  }, [redrawSelection, workingWidthMeters]);

  useEffect(() => {
    const handleMapClick = (event: L.LeafletMouseEvent) => {
      if (!isSelecting || isClosedRef.current) return;

      const firstPoint = pointsRef.current[0];
      const clickedFirstPoint =
        firstPoint &&
        pointsRef.current.length >= 3 &&
        map
          .latLngToContainerPoint(firstPoint)
          .distanceTo(map.latLngToContainerPoint(event.latlng)) <= 18;

      if (clickedFirstPoint) {
        isClosedRef.current = true;
        redrawSelection();
        syncSelection();
        return;
      }

      pointsRef.current = [...pointsRef.current, event.latlng];
      redrawSelection();
      syncSelection();
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [isSelecting, map, redrawSelection, syncSelection]);

  useEffect(() => {
    const routeLayer = routeLayerRef.current;
    if (!routeLayer) return;

    routeLayer.clearLayers();

    const coverageLines = swathsToCoverageLines(route?.swaths ?? []);
    const workingWidthMeters = route?.working_width ?? 6;
    const outerBoundaryCoordinates = route?.original_coordinates;
    const innerBoundaryCoordinates = outerBoundaryCoordinates
      ? buildInnerBoundaryCoordinates(outerBoundaryCoordinates, workingWidthMeters)
      : null;

    if (outerBoundaryCoordinates) {
      buildHeadlandCoverageRings(outerBoundaryCoordinates, workingWidthMeters).forEach((ring) => {
        L.polyline(
          ring.map(([lng, lat]) => [lat, lng] as [number, number]),
          HEADLAND_PASS_STYLE,
        ).addTo(routeLayer);
      });
    }

    coverageLines.forEach((line) => {
      L.polyline(
        [
          [line.start.lat, line.start.lng],
          [line.end.lat, line.end.lng],
        ],
        STRAIGHT_PATH_STYLE,
      ).addTo(routeLayer);
    });

    if (coverageLines.length < 2) return;

    const connectors = outerBoundaryCoordinates
      ? buildConstrainedConnectors(
          map,
          coverageLines,
          outerBoundaryCoordinates,
          innerBoundaryCoordinates,
          workingWidthMeters,
        )
      : buildSmoothCoveragePathForLeaflet(
          map,
          coverageLines,
          getSmoothPathOptions(workingWidthMeters),
        ).connectors;

    connectors.forEach((connector) => {
      L.polyline(
        connector.map((point) => [point.lat, point.lng] as [number, number]),
        CURVE_PATH_STYLE,
      ).addTo(routeLayer);
    });
  }, [map, route]);

  useEffect(() => {
    const bounds = drawnItemsRef.current?.getBounds();

    if (selection?.isClosed && bounds?.isValid()) {
      map.fitBounds(bounds.pad(0.2), { animate: true });
    }
  }, [map, selection]);

  return null;
}

function pointsToCoordinates(points: L.LatLng[], close: boolean): number[][] {
  const coordinates = points.map((point) => [point.lng, point.lat]);

  if (close && points[0]) {
    coordinates.push([points[0].lng, points[0].lat]);
  }

  return coordinates;
}

function getSmoothPathOptions(workingWidthMeters?: number): SmoothPathOptions {
  const implementWidth = Math.max(workingWidthMeters ?? 6, 1);
  const headlandWidth = getHeadlandWidthMeters(implementWidth);

  return {
    curveResolutionMeters: Math.max(implementWidth / 12, 0.3),
    minTurningRadiusMeters: headlandWidth / 2,
  };
}

function buildConstrainedConnectors(
  map: L.Map,
  coverageLines: CoverageLine[],
  outerBoundaryCoordinates: number[][],
  innerBoundaryCoordinates: number[][] | null,
  workingWidthMeters?: number,
): LatLngPoint[][] {
  const implementWidth = Math.max(workingWidthMeters ?? 6, 1);
  const headlandWidth = getHeadlandWidthMeters(implementWidth);
  const resolution = Math.max(implementWidth / 12, 0.3);
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
