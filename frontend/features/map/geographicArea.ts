import { area, booleanValid, polygon } from '@turf/turf';

export function calculateAreaHectares(coordinates: number[][]): number | null {
  if (
    coordinates.length < 3 ||
    coordinates.some(
      ([longitude, latitude]) =>
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude) ||
        longitude < -180 ||
        longitude > 180 ||
        latitude < -90 ||
        latitude > 90,
    )
  ) {
    return null;
  }

  const ring = coordinates.map(([longitude, latitude]) => [longitude, latitude]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([...first]);
  }

  const feature = polygon([ring]);
  if (!booleanValid(feature)) return null;
  const areaM2 = area(feature);
  if (!Number.isFinite(areaM2) || areaM2 <= 0) return null;
  return areaM2 / 10_000;
}

export function formatAreaHectares(areaHectares: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(areaHectares);
}
