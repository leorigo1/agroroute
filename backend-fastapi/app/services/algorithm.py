from __future__ import annotations

import math
from typing import Iterable

from pyproj import Transformer
from shapely import affinity
from shapely.geometry import GeometryCollection, LineString, MultiLineString, Polygon

# --- projeção: lon/lat (EPSG:4326) <-> metros UTM zona 22S (EPSG:32722)
# EPSG:32722 cobre o Rio Grande do Sul com precisão métrica
_fwd = Transformer.from_crs("EPSG:4326", "EPSG:32722", always_xy=True)
_inv = Transformer.from_crs("EPSG:32722", "EPSG:4326", always_xy=True)



# PROJEÇÃO DE COORDENADAS
def project_points(lonlat: Iterable[tuple[float, float]]) -> list[tuple[float, float]]:
    """Converte lista de (lon, lat) → (x, y) em metros."""
    return [(_fwd.transform(lon, lat)) for lon, lat in lonlat]


def unproject_points(xy: Iterable[tuple[float, float]]) -> list[list[float]]:
    """Converte lista de (x, y) metros → [lon, lat]."""
    return [[float(lon), float(lat)] for lon, lat in [_inv.transform(x, y) for x, y in xy]]


# FUNÇÕES AUXILIARES DE DISTÂNCIA
def _dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _swath_length(swath: list[tuple[float, float]]) -> float:
    """Comprimento total de uma faixa (soma dos segmentos internos)."""
    return sum(_dist(swath[i], swath[i + 1]) for i in range(len(swath) - 1))


def _transition_cost(swaths: list[list[tuple[float, float]]]) -> float:
    """Distância total de deslocamento entre o fim de uma faixa e início da próxima."""
    return sum(_dist(swaths[i][-1], swaths[i + 1][0]) for i in range(len(swaths) - 1))



# PASSO 1 — BOUSTROPHEDON: ÂNGULO ÓTIMO
def find_optimal_angle(polygon: Polygon, working_width: float) -> int:
    """
    Testa ângulos de 0° a 180° e retorna o que minimiza
    o número de faixas paralelas necessárias para cobrir o talhão.
    Menos faixas = menos manobras de cabeceira.
    """
    best_angle = 0
    best_count = float("inf")

    for angle in range(0, 181):
        rotated = affinity.rotate(polygon, angle, origin="centroid", use_radians=False)
        _, miny, _, maxy = rotated.bounds
        count = math.ceil((maxy - miny) / working_width)
        if count < best_count:
            best_count = count
            best_angle = angle

    return best_angle



# PASSO 2 — BOUSTROPHEDON: GERAR FAIXAS PARALELAS
def _extract_lines(geom) -> list[LineString]:
    """Extrai segmentos LineString de qualquer geometria resultante da intersecção."""
    if geom.is_empty:
        return []
    if isinstance(geom, LineString):
        return [geom] if geom.length > 0 else []
    if isinstance(geom, MultiLineString):
        return [g for g in geom.geoms if g.length > 0]
    if isinstance(geom, GeometryCollection):
        result = []
        for g in geom.geoms:
            result.extend(_extract_lines(g))
        return result
    return []


def generate_swaths(
    polygon: Polygon,
    working_width: float,
    angle: float,
) -> list[list[tuple[float, float]]]:
    """
    Gera faixas paralelas dentro do polígono no ângulo dado
    Cada faixa é uma lista de pontos (x, y) em metros

    Processo:
    1. Rotaciona o polígono para alinhar com o ângulo ótimo
    2. Varre linhas horizontais espaçadas por working_width
    3. Recorta cada linha com o polígono (shapely.intersection)
    4. Rotaciona os segmentos de volta ao sistema original
    """
    rotated_poly = affinity.rotate(polygon, angle, origin="centroid", use_radians=False)
    minx, miny, maxx, maxy = rotated_poly.bounds
    centroid = rotated_poly.centroid

    swaths: list[list[tuple[float, float]]] = []
    y = miny
    margin = working_width * 2  # garante que a linha cruze toda a largura

    while y <= maxy + 1e-6:
        line = LineString([(minx - margin, y), (maxx + margin, y)])
        clipped = rotated_poly.intersection(line)

        for seg in _extract_lines(clipped):
            # rotaciona o segmento de volta ao sistema de coordenadas original
            seg_original = affinity.rotate(seg, -angle, origin=centroid, use_radians=False)
            coords = [(float(x), float(y2)) for x, y2 in seg_original.coords]
            if len(coords) >= 2:
                swaths.append(coords)

        y += working_width

    return swaths


# PASSO 3 — NEAREST NEIGHBOR: ORDENAR FAIXAS
def nearest_neighbor(
    swaths: list[list[tuple[float, float]]],
) -> list[list[tuple[float, float]]]:
    """
    Ordena as faixas usando o algoritmo do vizinho mais próximo.

    A cada passo, a partir do ponto final da faixa atual,
    escolhe a faixa não visitada mais próxima — checando
    ambas as pontas para decidir a direção de entrada.

    Complexidade: O(n²) — aceitável para até ~500 faixas.
    """
    if not swaths:
        return []

    ordered = [swaths[0]]
    remaining = swaths[1:]

    while remaining:
        current_end = ordered[-1][-1]
        best_idx = 0
        best_dist = float("inf")
        best_flip = False

        for i, sw in enumerate(remaining):
            d_start = _dist(current_end, sw[0])   # entrar pela ponta inicial
            d_end = _dist(current_end, sw[-1])     # entrar pela ponta final (invertendo)

            if d_start < best_dist:
                best_dist = d_start
                best_idx = i
                best_flip = False

            if d_end < best_dist:
                best_dist = d_end
                best_idx = i
                best_flip = True

        next_swath = remaining.pop(best_idx)
        if best_flip:
            next_swath = list(reversed(next_swath))  # inverte direção da faixa
        ordered.append(next_swath)

    return ordered


# PASSO 4 — 2-OPT: MELHORAR A SEQUÊNCIA
def two_opt(
    swaths: list[list[tuple[float, float]]],
) -> list[list[tuple[float, float]]]:
    """
    Melhora a sequência gerada pelo Nearest Neighborq.

    Testa reversões de subsequências: se inverter o trecho [i..k]
    reduz a distância total de deslocamento, aplica a troca.
    Repete até não encontrar melhoria.

    Baseado em: Oksanen & Visala (2009).
    """
    if len(swaths) < 4:
        return swaths

    best = swaths[:]
    best_cost = _transition_cost(best)
    improved = True

    while improved:
        improved = False
        n = len(best)
        for i in range(1, n - 2):
            for k in range(i + 1, n - 1):
                # inverte o trecho entre i e k (inclusive), revertendo também a direção de cada faixa
                candidate = (
                    best[:i]
                    + [list(reversed(s)) for s in reversed(best[i: k + 1])]
                    + best[k + 1:]
                )
                cost = _transition_cost(candidate)
                if cost + 1e-9 < best_cost:
                    best = candidate
                    best_cost = cost
                    improved = True
                    break
            if improved:
                break

    return best


# PASSO 5 — MÉTRICAS
def calculate_metrics(
    swaths: list[list[tuple[float, float]]],
    speed_kmh: float,
    fuel_lph: float,  # litros por hora
) -> tuple[float, float, float]:
    """
    Calcula distância total, tempo estimado e consumo de combustível.

    Distância total = soma das faixas de trabalho + deslocamentos entre faixas.

    fuel_lph = litros por hora
    """

    internal = sum(_swath_length(s) for s in swaths)
    transitions = _transition_cost(swaths)

    total_m = internal + transitions
    total_km = total_m / 1000.0

    # tempo em horas
    time_h = total_km / speed_kmh if speed_kmh > 0 else 0.0

    # tempo em minutos
    time_min = time_h * 60.0

    # consumo total
    fuel_liters = time_h * fuel_lph

    return round(total_m, 2), round(time_min, 2), round(fuel_liters, 2)


# FUNÇÃO PÚBLICA — chamada pelo endpoint
def plan_coverage_route(
    polygon_lonlat: Polygon,
    working_width_m: float,
    speed_kmh: float,
    fuel_lph: float,
) -> tuple[list[list[list[float]]], float, float, float]:
    """
    Ponto de entrada do algoritmo.

    Recebe um Polygon em lon/lat (EPSG:4326) e parâmetros da máquina.
    Retorna as faixas em lon/lat + métricas.

    Passos internos:
        1. Projeta para metros (EPSG:32722)
        2. find_optimal_angle     ← Boustrophedon ângulo
        3. generate_swaths        ← Boustrophedon faixas
        4. nearest_neighbor       ← ordena faixas
        5. two_opt                ← melhora a ordem
        6. calculate_metrics      ← distância, tempo, combustível
        7. Reprojecta para lon/lat
    """

    if polygon_lonlat.is_empty:
        return [], 0.0, 0.0, 0.0 # corrige erro de retorno Nan nos teses
    # 1. projetar para metros
    ring_lonlat = list(polygon_lonlat.exterior.coords)
    ring_xy = project_points([(float(lon), float(lat)) for lon, lat in ring_lonlat])
    polygon_xy = Polygon(ring_xy)

    if not polygon_xy.is_valid:
        polygon_xy = polygon_xy.buffer(0)

    # 2-3. boustrophedon
    angle = find_optimal_angle(polygon_xy, working_width_m)
    swaths_xy = generate_swaths(polygon_xy, working_width_m, angle)

    if not swaths_xy:
        return [], 0.0, 0.0, 0.0

    # 4-5. nearest neighbor + 2-opt
    swaths_xy = nearest_neighbor(swaths_xy)
    swaths_xy = two_opt(swaths_xy)

    # 6. métricas
    total_m, time_min, fuel_liters = calculate_metrics(
    swaths_xy,
    speed_kmh,
    fuel_lph
    )

    # 7. reprojetar de volta para lon/lat
    swaths_lonlat = [unproject_points(sw) for sw in swaths_xy]

    return swaths_lonlat, total_m, time_min, fuel_liters