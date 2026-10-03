import math

from pyproj import Geod
from shapely.geometry import Polygon

_WGS84_GEOD = Geod(ellps="WGS84")


def calculate_polygon_area(coordinates: list[list[float]]) -> dict[str, float]:
    if len(coordinates) < 3:
        raise ValueError("O polígono precisa de pelo menos três pontos.")

    ring: list[tuple[float, float]] = []
    for coordinate in coordinates:
        if len(coordinate) != 2:
            raise ValueError("Cada coordenada deve conter longitude e latitude.")
        longitude, latitude = float(coordinate[0]), float(coordinate[1])
        if (
            not math.isfinite(longitude)
            or not math.isfinite(latitude)
            or not -180 <= longitude <= 180
            or not -90 <= latitude <= 90
        ):
            raise ValueError("O polígono contém coordenadas geográficas inválidas.")
        ring.append((longitude, latitude))

    if ring[0] != ring[-1]:
        ring.append(ring[0])

    polygon = Polygon(ring)
    if not polygon.is_valid or polygon.is_empty:
        raise ValueError("O polígono selecionado é inválido.")

    area_m2, _ = _WGS84_GEOD.geometry_area_perimeter(polygon)
    area_m2 = abs(area_m2)
    if not math.isfinite(area_m2) or area_m2 <= 0:
        raise ValueError("O polígono selecionado não possui área válida.")

    return {
        "area_m2": area_m2,
        "area_hectares": area_m2 / 10_000,
    }
