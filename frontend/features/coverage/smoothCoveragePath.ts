export type LatLngPoint = {
  lat: number;
  lng: number;
};

export type CoverageLine = {
  start: LatLngPoint;
  end: LatLngPoint;
};

export type SmoothPathOptions = {
  minTurningRadiusMeters: number;
  curveResolutionMeters: number;
};

export type Point = {
  x: number;
  y: number;
};

export type PlanarPose = {
  x: number;
  y: number;
  heading: number;
};

export type PlanarCoverageLine = {
  start: Point;
  end: Point;
};

export type PlanarSmoothCoveragePathResult = {
  points: Point[];
  connectors: Point[][];
  fallbackConnectors: Point[][];
};

type DubinsMode = 'L' | 'S' | 'R';
type DubinsCandidate = {
  modes: [DubinsMode, DubinsMode, DubinsMode];
  lengths: [number, number, number];
  totalLength: number;
};

const TWO_PI = Math.PI * 2;
const EPSILON = 1e-9;

export function normalizeAngle(angle: number): number {
  const normalized = angle % TWO_PI;
  return normalized < 0 ? normalized + TWO_PI : normalized;
}

export function calculateHeading(start: Point, end: Point): number {
  return normalizeAngle(Math.atan2(end.y - start.y, end.x - start.x));
}

export function buildPoseFromLineEnd(line: PlanarCoverageLine): PlanarPose {
  return {
    ...line.end,
    heading: calculateHeading(line.start, line.end),
  };
}

export function buildPoseFromLineStart(line: PlanarCoverageLine): PlanarPose {
  return {
    ...line.start,
    heading: calculateHeading(line.start, line.end),
  };
}

export function buildSmoothCoveragePathFromPlanarLines(
  lines: PlanarCoverageLine[],
  options: SmoothPathOptions,
): PlanarSmoothCoveragePathResult {
  if (lines.length < 2) {
    return {
      points: lines[0] ? [lines[0].start, lines[0].end] : [],
      connectors: [],
      fallbackConnectors: [],
    };
  }

  const points: Point[] = [lines[0].start, lines[0].end];
  const connectors: Point[][] = [];
  const fallbackConnectors: Point[][] = [];

  for (let index = 0; index < lines.length - 1; index += 1) {
    const currentLine = lines[index];
    const nextLine = lines[index + 1];
    const connector = generateDubinsConnector(
      buildPoseFromLineEnd(currentLine),
      buildPoseFromLineStart(nextLine),
      options,
    );

    if (connector.length >= 2) {
      connectors.push(connector);
      points.push(...connector.slice(1));
    } else {
      const fallback = [currentLine.end, nextLine.start];
      connectors.push(fallback);
      fallbackConnectors.push(fallback);
      points.push(nextLine.start);
    }

    points.push(nextLine.end);
  }

  return {
    points: dedupeSequentialPoints(points),
    connectors,
    fallbackConnectors,
  };
}

export function generateDubinsConnector(
  startPose: PlanarPose,
  endPose: PlanarPose,
  options: SmoothPathOptions,
): Point[] {
  const radius = Math.max(options.minTurningRadiusMeters, EPSILON);
  const resolution = Math.max(options.curveResolutionMeters, EPSILON);
  const dx = (endPose.x - startPose.x) / radius;
  const dy = (endPose.y - startPose.y) / radius;
  const distance = Math.hypot(dx, dy);

  if (distance < EPSILON) return [];

  const theta = Math.atan2(dy, dx);
  const alpha = normalizeAngle(startPose.heading - theta);
  const beta = normalizeAngle(endPose.heading - theta);
  const candidates = [
    calculateLsl(alpha, beta, distance),
    calculateRsr(alpha, beta, distance),
    calculateLsr(alpha, beta, distance),
    calculateRsl(alpha, beta, distance),
    calculateRlr(alpha, beta, distance),
    calculateLrl(alpha, beta, distance),
  ].filter((candidate): candidate is DubinsCandidate => Boolean(candidate));

  const shortest = candidates.sort((first, second) => first.totalLength - second.totalLength)[0];
  if (!shortest) return [];

  return sampleDubinsPath(startPose, shortest, radius, resolution);
}

function calculateLsl(alpha: number, beta: number, distance: number): DubinsCandidate | null {
  const tmp = distance + Math.sin(alpha) - Math.sin(beta);
  const pSquared =
    2 + distance ** 2 - 2 * Math.cos(alpha - beta) + 2 * distance * (Math.sin(alpha) - Math.sin(beta));

  if (pSquared < 0) return null;

  const p = Math.sqrt(pSquared);
  const angle = Math.atan2(Math.cos(beta) - Math.cos(alpha), tmp);

  return makeCandidate(['L', 'S', 'L'], [
    normalizeAngle(-alpha + angle),
    p,
    normalizeAngle(beta - angle),
  ]);
}

function calculateRsr(alpha: number, beta: number, distance: number): DubinsCandidate | null {
  const tmp = distance - Math.sin(alpha) + Math.sin(beta);
  const pSquared =
    2 + distance ** 2 - 2 * Math.cos(alpha - beta) + 2 * distance * (-Math.sin(alpha) + Math.sin(beta));

  if (pSquared < 0) return null;

  const p = Math.sqrt(pSquared);
  const angle = Math.atan2(Math.cos(alpha) - Math.cos(beta), tmp);

  return makeCandidate(['R', 'S', 'R'], [
    normalizeAngle(alpha - angle),
    p,
    normalizeAngle(-beta + angle),
  ]);
}

function calculateLsr(alpha: number, beta: number, distance: number): DubinsCandidate | null {
  const pSquared =
    -2 + distance ** 2 + 2 * Math.cos(alpha - beta) + 2 * distance * (Math.sin(alpha) + Math.sin(beta));

  if (pSquared < 0) return null;

  const p = Math.sqrt(pSquared);
  const angle =
    Math.atan2(-Math.cos(alpha) - Math.cos(beta), distance + Math.sin(alpha) + Math.sin(beta)) -
    Math.atan2(-2, p);

  return makeCandidate(['L', 'S', 'R'], [
    normalizeAngle(-alpha + angle),
    p,
    normalizeAngle(-beta + angle),
  ]);
}

function calculateRsl(alpha: number, beta: number, distance: number): DubinsCandidate | null {
  const pSquared =
    -2 + distance ** 2 + 2 * Math.cos(alpha - beta) - 2 * distance * (Math.sin(alpha) + Math.sin(beta));

  if (pSquared < 0) return null;

  const p = Math.sqrt(pSquared);
  const angle =
    Math.atan2(Math.cos(alpha) + Math.cos(beta), distance - Math.sin(alpha) - Math.sin(beta)) -
    Math.atan2(2, p);

  return makeCandidate(['R', 'S', 'L'], [
    normalizeAngle(alpha - angle),
    p,
    normalizeAngle(beta - angle),
  ]);
}

function calculateRlr(alpha: number, beta: number, distance: number): DubinsCandidate | null {
  const tmp =
    (6 - distance ** 2 + 2 * Math.cos(alpha - beta) + 2 * distance * (Math.sin(alpha) - Math.sin(beta))) / 8;

  if (Math.abs(tmp) > 1) return null;

  const p = normalizeAngle(TWO_PI - Math.acos(tmp));
  const t = normalizeAngle(
    alpha - Math.atan2(Math.cos(alpha) - Math.cos(beta), distance - Math.sin(alpha) + Math.sin(beta)) + p / 2,
  );

  return makeCandidate(['R', 'L', 'R'], [t, p, normalizeAngle(alpha - beta - t + p)]);
}

function calculateLrl(alpha: number, beta: number, distance: number): DubinsCandidate | null {
  const tmp =
    (6 - distance ** 2 + 2 * Math.cos(alpha - beta) + 2 * distance * (-Math.sin(alpha) + Math.sin(beta))) / 8;

  if (Math.abs(tmp) > 1) return null;

  const p = normalizeAngle(TWO_PI - Math.acos(tmp));
  const t = normalizeAngle(
    -alpha - Math.atan2(Math.cos(alpha) - Math.cos(beta), distance + Math.sin(alpha) - Math.sin(beta)) + p / 2,
  );

  return makeCandidate(['L', 'R', 'L'], [t, p, normalizeAngle(beta - alpha - t + p)]);
}

function makeCandidate(
  modes: [DubinsMode, DubinsMode, DubinsMode],
  lengths: [number, number, number],
): DubinsCandidate {
  return {
    modes,
    lengths,
    totalLength: lengths[0] + lengths[1] + lengths[2],
  };
}

function sampleDubinsPath(
  startPose: PlanarPose,
  candidate: DubinsCandidate,
  radius: number,
  resolution: number,
): Point[] {
  const points: Point[] = [{ x: startPose.x, y: startPose.y }];
  const step = Math.max(resolution / radius, EPSILON);
  const state = {
    x: startPose.x / radius,
    y: startPose.y / radius,
    heading: startPose.heading,
  };

  candidate.modes.forEach((mode, index) => {
    const segmentLength = candidate.lengths[index];
    let traveled = 0;

    while (traveled + step < segmentLength) {
      advanceState(state, mode, step);
      points.push({ x: state.x * radius, y: state.y * radius });
      traveled += step;
    }

    const remaining = segmentLength - traveled;
    if (remaining > EPSILON) {
      advanceState(state, mode, remaining);
      points.push({ x: state.x * radius, y: state.y * radius });
    }
  });

  return dedupeSequentialPoints(points);
}

function advanceState(
  state: { x: number; y: number; heading: number },
  mode: DubinsMode,
  distance: number,
) {
  if (mode === 'S') {
    state.x += distance * Math.cos(state.heading);
    state.y += distance * Math.sin(state.heading);
    return;
  }

  const turnDirection = mode === 'L' ? 1 : -1;
  const nextHeading = state.heading + turnDirection * distance;

  state.x += (Math.sin(nextHeading) - Math.sin(state.heading)) / turnDirection;
  state.y += (-Math.cos(nextHeading) + Math.cos(state.heading)) / turnDirection;
  state.heading = normalizeAngle(nextHeading);
}

function dedupeSequentialPoints<T extends Point>(points: T[]): T[] {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    if (!previous) return true;

    return Math.hypot(point.x - previous.x, point.y - previous.y) > EPSILON;
  });
}
