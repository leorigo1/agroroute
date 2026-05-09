import L from 'leaflet';
import {
  buildSmoothCoveragePathFromPlanarLines,
  CoverageLine,
  LatLngPoint,
  PlanarCoverageLine,
  PlanarSmoothCoveragePathResult,
  Point,
  SmoothPathOptions,
} from './smoothCoveragePath';

const EARTH_CIRCUMFERENCE_METERS = 40_075_016.686;
const TILE_SIZE = 256;

type LeafletProjectionContext = {
  map: L.Map;
  originPoint: L.Point;
  metersPerPixel: number;
  zoom: number;
};

export type LeafletSmoothCoveragePathResult = {
  points: LatLngPoint[];
  connectors: LatLngPoint[][];
  fallbackConnectors: LatLngPoint[][];
  planar: PlanarSmoothCoveragePathResult;
};

export function buildSmoothCoveragePathForLeaflet(
  map: L.Map,
  lines: CoverageLine[],
  options: SmoothPathOptions,
): LeafletSmoothCoveragePathResult {
  const context = createLeafletProjectionContext(map, lines);
  const planarLines = lines.map((line): PlanarCoverageLine => ({
    start: latLngToPoint(context, line.start),
    end: latLngToPoint(context, line.end),
  }));
  const planar = buildSmoothCoveragePathFromPlanarLines(planarLines, options);

  return {
    points: planar.points.map((point) => pointToLatLng(context, point)),
    connectors: planar.connectors.map((connector) =>
      connector.map((point) => pointToLatLng(context, point)),
    ),
    fallbackConnectors: planar.fallbackConnectors.map((connector) =>
      connector.map((point) => pointToLatLng(context, point)),
    ),
    planar,
  };
}

export function swathsToCoverageLines(swaths: number[][][]): CoverageLine[] {
  return swaths.flatMap((swath) => {
    if (swath.length < 2) return [];

    return {
      start: lonLatToLatLngPoint(swath[0]),
      end: lonLatToLatLngPoint(swath[swath.length - 1]),
    };
  });
}

function latLngToPoint(context: LeafletProjectionContext, latLng: LatLngPoint): Point {
  const projected = context.map.project(L.latLng(latLng.lat, latLng.lng), context.zoom);

  return {
    x: (projected.x - context.originPoint.x) * context.metersPerPixel,
    y: (projected.y - context.originPoint.y) * context.metersPerPixel,
  };
}

function pointToLatLng(context: LeafletProjectionContext, point: Point): LatLngPoint {
  const projected = L.point(
    point.x / context.metersPerPixel + context.originPoint.x,
    point.y / context.metersPerPixel + context.originPoint.y,
  );
  const latLng = context.map.unproject(projected, context.zoom);

  return {
    lat: latLng.lat,
    lng: latLng.lng,
  };
}

function createLeafletProjectionContext(
  map: L.Map,
  lines: CoverageLine[],
): LeafletProjectionContext {
  const allPoints = lines.flatMap((line) => [line.start, line.end]);
  const origin = L.latLng(
    allPoints.reduce((sum, point) => sum + point.lat, 0) / Math.max(allPoints.length, 1),
    allPoints.reduce((sum, point) => sum + point.lng, 0) / Math.max(allPoints.length, 1),
  );
  const zoom = map.getZoom();
  const metersPerPixel =
    (Math.cos((origin.lat * Math.PI) / 180) * EARTH_CIRCUMFERENCE_METERS) /
    (TILE_SIZE * 2 ** zoom);

  return {
    map,
    metersPerPixel,
    originPoint: map.project(origin, zoom),
    zoom,
  };
}

function lonLatToLatLngPoint(coordinate: number[]): LatLngPoint {
  return {
    lat: coordinate[1],
    lng: coordinate[0],
  };
}
