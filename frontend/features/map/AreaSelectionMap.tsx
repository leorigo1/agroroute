'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNewAreaSelection } from './NewAreaSelectionContext';

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
          opacity: 0.95,
          weight: 3,
        }).addTo(drawnItems);
      } else {
        L.polyline(path, {
          color: '#f97316',
          opacity: 0.95,
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
  }, []);

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
    route?.swaths?.forEach((swath) => {
      const coords = swath.coordinates;
      if (!coords || coords.length < 2) return;

      L.polyline(
        coords.map(([lng, lat]) => [lat, lng] as [number, number]),
        {
          color: '#facc15',
          opacity: 0.9,
          weight: 2,
        },
      ).addTo(routeLayer);
    });
  }, [route]);

  useEffect(() => {
    const bounds = drawnItemsRef.current?.getBounds();

    if (selection?.isClosed && bounds?.isValid()) {
      map.fitBounds(bounds.pad(0.2), { animate: true });
    }
  }, [map, selection]);

  return null;
}
