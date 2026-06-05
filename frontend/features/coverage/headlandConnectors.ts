import L from 'leaflet';
import { along, length, lineString, nearestPointOnLine } from '@turf/turf';
import { buildSmoothCoveragePathForLeaflet } from './leafletSmoothCoveragePath';
import { CoverageLine, LatLngPoint, SmoothPathOptions } from './smoothCoveragePath';
import { getHeadlandWidthMeters, isConnectorInsideHeadlandZone } from './headland';

type BoundarySnap = {
  distanceKilometers: number;
};

const MIN_BOUNDARY_SAMPLE_METERS = 0.5;

export function getHeadlandSmoothPathOptions(workingWidthMeters: number): SmoothPathOptions {
  const implementWidth = Math.max(workingWidthMeters, 1);
  const headlandWidth = getHeadlandWidthMeters(implementWidth);

  return {
    curveResolutionMeters: Math.max(implementWidth / 8, MIN_BOUNDARY_SAMPLE_METERS),
    minTurningRadiusMeters: headlandWidth / 2,
  };
}

export function buildHeadlandAwareConnectors(
  map: L.Map,
  coverageLines: CoverageLine[],
  outerBoundaryCoordinates: number[][],
  innerBoundaryCoordinates: number[][] | null,
  workingWidthMeters: number,
): LatLngPoint[][] {
  const implementWidth = Math.max(workingWidthMeters, 1);
  const headlandWidth = getHeadlandWidthMeters(implementWidth);
  const resolution = Math.max(implementWidth / 8, MIN_BOUNDARY_SAMPLE_METERS);
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
    const smoothConnector = radiusCandidates
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

    connectors.push(
      smoothConnector ??
        buildInnerBoundaryConnector(
          currentLine.end,
          nextLine.start,
          innerBoundaryCoordinates,
          workingWidthMeters,
        ),
    );
  }

  return connectors;
}

function buildInnerBoundaryConnector(
  start: LatLngPoint,
  end: LatLngPoint,
  innerBoundaryCoordinates: number[][] | null,
  workingWidthMeters: number,
): LatLngPoint[] {
  const closedBoundary = innerBoundaryCoordinates ? closeRing(innerBoundaryCoordinates) : [];

  if (closedBoundary.length < 4) {
    return dedupeSequentialLatLngPoints([start, end]);
  }

  const boundaryLine = lineString(closedBoundary);
  const totalKilometers = length(boundaryLine, { units: 'kilometers' });

  if (totalKilometers <= 0) {
    return dedupeSequentialLatLngPoints([start, end]);
  }

  const startSnap = snapPointToBoundary(start, boundaryLine);
  const endSnap = snapPointToBoundary(end, boundaryLine);
  const forwardDistance = wrapDistance(
    endSnap.distanceKilometers - startSnap.distanceKilometers,
    totalKilometers,
  );
  const backwardDistance = wrapDistance(
    startSnap.distanceKilometers - endSnap.distanceKilometers,
    totalKilometers,
  );
  const boundaryPoints = sampleBoundaryBetween(
    boundaryLine,
    startSnap.distanceKilometers,
    endSnap.distanceKilometers,
    totalKilometers,
    forwardDistance <= backwardDistance,
    Math.max(workingWidthMeters / 4, MIN_BOUNDARY_SAMPLE_METERS) / 1000,
  );

  return dedupeSequentialLatLngPoints([start, ...boundaryPoints, end]);
}

function snapPointToBoundary(
  latLng: LatLngPoint,
  boundaryLine: ReturnType<typeof lineString>,
): BoundarySnap {
  const snapped = nearestPointOnLine(
    boundaryLine,
    [latLng.lng, latLng.lat],
    { units: 'kilometers' },
  );

  return {
    distanceKilometers: Number(snapped.properties.location ?? 0),
  };
}

function sampleBoundaryBetween(
  boundaryLine: ReturnType<typeof lineString>,
  startKilometers: number,
  endKilometers: number,
  totalKilometers: number,
  forward: boolean,
  stepKilometers: number,
): LatLngPoint[] {
  const distanceToTravel = forward
    ? wrapDistance(endKilometers - startKilometers, totalKilometers)
    : wrapDistance(startKilometers - endKilometers, totalKilometers);
  const samples: LatLngPoint[] = [];

  for (
    let traveledKilometers = 0;
    traveledKilometers <= distanceToTravel;
    traveledKilometers += stepKilometers
  ) {
    samples.push(
      pointAlongBoundary(
        boundaryLine,
        forward ? startKilometers + traveledKilometers : startKilometers - traveledKilometers,
        totalKilometers,
      ),
    );
  }

  samples.push(pointAlongBoundary(boundaryLine, endKilometers, totalKilometers));

  return samples;
}

function pointAlongBoundary(
  boundaryLine: ReturnType<typeof lineString>,
  distanceKilometers: number,
  totalKilometers: number,
): LatLngPoint {
  const normalizedDistance = wrapDistance(distanceKilometers, totalKilometers);
  const [lng, lat] = along(boundaryLine, normalizedDistance, {
    units: 'kilometers',
  }).geometry.coordinates;

  return { lat, lng };
}

function wrapDistance(distance: number, total: number): number {
  const wrapped = distance % total;

  return wrapped < 0 ? wrapped + total : wrapped;
}

function closeRing(coordinates: number[][]): number[][] {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];

  if (!first || !last) return coordinates;
  if (first[0] === last[0] && first[1] === last[1]) return coordinates;

  return [...coordinates, first];
}

function dedupeSequentialLatLngPoints(points: LatLngPoint[]): LatLngPoint[] {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    if (!previous) return true;

    return Math.hypot(point.lat - previous.lat, point.lng - previous.lng) > 1e-12;
  });
}
