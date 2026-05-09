import {
  along,
  area,
  booleanPointInPolygon,
  buffer,
  length,
  lineIntersect,
  lineString,
  point,
  polygonToLine,
  polygon,
} from '@turf/turf';
import { Feature, MultiPolygon, Polygon } from 'geojson';
import { CoverageLine, LatLngPoint } from './smoothCoveragePath';

const METERS_TO_KILOMETERS = 0.001;
export const HEADLAND_WIDTH_MULTIPLIER = 2;

export function getHeadlandWidthMeters(workingWidthMeters: number): number {
  return Math.max(workingWidthMeters, 0) * HEADLAND_WIDTH_MULTIPLIER;
}

export function buildInnerBoundaryCoordinates(
  coordinates: number[][],
  workingWidthMeters: number,
): number[][] | null {
  const closedCoordinates = closeRing(coordinates);

  if (closedCoordinates.length < 4) return null;

  const headlandWidthMeters = getHeadlandWidthMeters(workingWidthMeters);
  const sourcePolygon = polygon([closedCoordinates]);
  const inner = buffer(sourcePolygon, -headlandWidthMeters * METERS_TO_KILOMETERS, {
    units: 'kilometers',
  });

  if (!inner) return null;

  const geometry = inner.geometry;

  if (geometry.type === 'Polygon') {
    return normalizeRing(geometry.coordinates[0]);
  }

  if (geometry.type === 'MultiPolygon') {
    const largestPolygon = pickLargestPolygon(geometry);
    return largestPolygon ? normalizeRing(largestPolygon.coordinates[0]) : null;
  }

  return null;
}

export function buildOuterBoundaryFromInnerCoordinates(
  innerCoordinates: number[][],
  workingWidthMeters: number,
): number[][] | null {
  const closedCoordinates = closeRing(innerCoordinates);

  if (closedCoordinates.length < 4) return null;

  const headlandWidthMeters = getHeadlandWidthMeters(workingWidthMeters);
  const sourcePolygon = polygon([closedCoordinates]);
  const outer = buffer(sourcePolygon, headlandWidthMeters * METERS_TO_KILOMETERS, {
    units: 'kilometers',
  });

  if (!outer) return null;

  const geometry = outer.geometry;

  if (geometry.type === 'Polygon') {
    return normalizeRing(geometry.coordinates[0]);
  }

  if (geometry.type === 'MultiPolygon') {
    const largestPolygon = pickLargestPolygon(geometry);
    return largestPolygon ? normalizeRing(largestPolygon.coordinates[0]) : null;
  }

  return null;
}

export function buildHeadlandCoverageRings(
  coordinates: number[][],
  workingWidthMeters: number,
): number[][][] {
  const closedCoordinates = closeRing(coordinates);

  if (closedCoordinates.length < 4 || workingWidthMeters <= 0) return [];

  const headlandWidthMeters = getHeadlandWidthMeters(workingWidthMeters);
  const sourcePolygon = polygon([closedCoordinates]);
  const rings: number[][][] = [];

  for (
    let offsetMeters = workingWidthMeters / 2;
    offsetMeters < headlandWidthMeters;
    offsetMeters += workingWidthMeters
  ) {
    const offset = buffer(sourcePolygon, -offsetMeters * METERS_TO_KILOMETERS, {
      units: 'kilometers',
    });

    if (!offset) continue;

    const geometry = offset.geometry;

    if (geometry.type === 'Polygon') {
      rings.push(normalizeRing(geometry.coordinates[0]));
    }

    if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach((polygonCoordinates) => {
        rings.push(normalizeRing(polygonCoordinates[0]));
      });
    }
  }

  return rings;
}

export function isPointInsideHeadlandZone(
  latLng: LatLngPoint,
  outerCoordinates: number[][],
  innerCoordinates: number[][] | null,
): boolean {
  const turfPoint = point([latLng.lng, latLng.lat]);
  const outerPolygon = polygon([closeRing(outerCoordinates)]);
  const insideOuter = booleanPointInPolygon(turfPoint, outerPolygon);

  if (!insideOuter) return false;
  if (!innerCoordinates) return true;

  const innerPolygon = polygon([closeRing(innerCoordinates)]);
  const insideInnerStrictly = booleanPointInPolygon(turfPoint, innerPolygon, {
    ignoreBoundary: true,
  });

  return !insideInnerStrictly;
}

export function isConnectorInsideHeadlandZone(
  connector: LatLngPoint[],
  outerCoordinates: number[][],
  innerCoordinates: number[][] | null,
): boolean {
  if (!connector.length) return false;

  const allPointsInsideField = connector.every((latLng) =>
    isPointInsideField(latLng, outerCoordinates),
  );

  if (!allPointsInsideField) return false;
  if (!innerCoordinates) return true;

  const connectorWithoutTangencyEnds = connector.slice(1, -1);
  const pointsToValidate = connectorWithoutTangencyEnds.length
    ? connectorWithoutTangencyEnds
    : connector;
  const headlandPointCount = pointsToValidate.filter((latLng) =>
    isPointInsideHeadlandZone(latLng, outerCoordinates, innerCoordinates),
  ).length;

  return headlandPointCount / pointsToValidate.length >= 0.5;
}

export function trimCoverageLinesAtHeadlandEntry(
  lines: CoverageLine[],
  workingWidthMeters: number,
  innerCoordinates?: number[][] | null,
): CoverageLine[] {
  const headlandWidthMeters = getHeadlandWidthMeters(workingWidthMeters);

  return lines.map((line, index) =>
    innerCoordinates
      ? trimCoverageLineAtInnerBoundary(line, innerCoordinates, {
          trimEnd: index < lines.length - 1,
          trimStart: index > 0,
        }) ??
        trimCoverageLine(line, {
          trimEndMeters: index < lines.length - 1 ? headlandWidthMeters : 0,
          trimStartMeters: index > 0 ? headlandWidthMeters : 0,
        })
      : trimCoverageLine(line, {
          trimEndMeters: index < lines.length - 1 ? headlandWidthMeters : 0,
          trimStartMeters: index > 0 ? headlandWidthMeters : 0,
        }),
  );
}

export function isPointInsideField(
  latLng: LatLngPoint,
  outerCoordinates: number[][],
): boolean {
  return booleanPointInPolygon(point([latLng.lng, latLng.lat]), polygon([closeRing(outerCoordinates)]));
}

function trimCoverageLine(
  line: CoverageLine,
  options: { trimStartMeters: number; trimEndMeters: number },
): CoverageLine {
  const turfLine = lineString([
    [line.start.lng, line.start.lat],
    [line.end.lng, line.end.lat],
  ]);
  const lineLengthKilometers = length(turfLine, { units: 'kilometers' });
  const lineLengthMeters = lineLengthKilometers * 1000;
  const maxTrimMeters = Math.max(lineLengthMeters / 2 - 0.01, 0);
  const trimStartMeters = Math.min(options.trimStartMeters, maxTrimMeters);
  const trimEndMeters = Math.min(options.trimEndMeters, maxTrimMeters);

  if (trimStartMeters + trimEndMeters >= lineLengthMeters) {
    return line;
  }

  const trimmedStart = along(turfLine, trimStartMeters / 1000, {
    units: 'kilometers',
  }).geometry.coordinates;
  const trimmedEnd = along(turfLine, (lineLengthMeters - trimEndMeters) / 1000, {
    units: 'kilometers',
  }).geometry.coordinates;

  return {
    start: {
      lat: trimmedStart[1],
      lng: trimmedStart[0],
    },
    end: {
      lat: trimmedEnd[1],
      lng: trimmedEnd[0],
    },
  };
}

function trimCoverageLineAtInnerBoundary(
  line: CoverageLine,
  innerCoordinates: number[][],
  options: { trimStart: boolean; trimEnd: boolean },
): CoverageLine | null {
  const turfLine = lineString([
    [line.start.lng, line.start.lat],
    [line.end.lng, line.end.lat],
  ]);
  const boundary = polygonToLine(polygon([closeRing(innerCoordinates)]));
  const intersections = lineIntersect(turfLine, boundary).features
    .map((feature) => feature.geometry.coordinates)
    .map(([lng, lat]) => ({
      distanceMeters:
        length(
          lineString([
            [line.start.lng, line.start.lat],
            [lng, lat],
          ]),
          { units: 'kilometers' },
        ) * 1000,
      point: { lat, lng },
    }))
    .sort((first, second) => first.distanceMeters - second.distanceMeters);

  if (!intersections.length) return null;

  const lineLengthMeters = length(turfLine, { units: 'kilometers' }) * 1000;
  const startPoint = options.trimStart ? intersections[0]?.point : line.start;
  const endPoint = options.trimEnd
    ? intersections
        .slice()
        .reverse()
        .find((intersection) => intersection.distanceMeters < lineLengthMeters)?.point
    : line.end;

  if (!startPoint || !endPoint) return null;

  return {
    start: startPoint,
    end: endPoint,
  };
}

function pickLargestPolygon(geometry: MultiPolygon): Polygon | null {
  return geometry.coordinates
    .map((coordinates): Polygon => ({
      type: 'Polygon',
      coordinates,
    }))
    .sort((first, second) => polygonArea(second) - polygonArea(first))[0] ?? null;
}

function polygonArea(geometry: Polygon): number {
  return area({
    type: 'Feature',
    properties: {},
    geometry,
  } satisfies Feature<Polygon>);
}

function closeRing(coordinates: number[][]): number[][] {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];

  if (!first || !last) return coordinates;
  if (first[0] === last[0] && first[1] === last[1]) return coordinates;

  return [...coordinates, first];
}

function normalizeRing(coordinates: number[][]): number[][] {
  return closeRing(coordinates).map(([lng, lat]) => [lng, lat]);
}
