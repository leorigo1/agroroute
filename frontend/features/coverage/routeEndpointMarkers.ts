import L from 'leaflet';
import { CoverageLine, LatLngPoint } from './smoothCoveragePath';

type RouteEndpoint = {
  color: string;
  point: LatLngPoint;
};

export function addRouteEndpointMarkers(
  target: L.Map | L.LayerGroup,
  coverageLines: CoverageLine[],
) {
  if (!coverageLines.length) return;

  const firstLine = coverageLines[0];
  const lastLine = coverageLines[coverageLines.length - 1];

  if (!firstLine || !lastLine) return;

  const endpoints: RouteEndpoint[] = [
    {
      color: '#16a34a',
      point: firstLine.start,
    },
    {
      color: '#dc2626',
      point: lastLine.end,
    },
  ];

  endpoints.forEach((endpoint) => {
    L.circleMarker([endpoint.point.lat, endpoint.point.lng], {
      color: '#ffffff',
      fillColor: endpoint.color,
      fillOpacity: 1,
      interactive: false,
      radius: 7,
      weight: 2,
    }).addTo(target);
  });
}
