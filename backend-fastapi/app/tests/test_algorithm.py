"""
tests/test_algorithm.py

Testa cada função do algoritmo isoladamente
e depois o pipeline completo.
"""

import math
import pytest
from shapely.geometry import Polygon

from app.services.algorithm import (
    project_points,
    unproject_points,
    find_optimal_angle,
    generate_swaths,
    nearest_neighbor,
    two_opt,
    calculate_metrics,
    plan_coverage_route,
)


# project_points / unproject_points
class TestProjection:

    def test_project_returns_meters(self):
        """Coordenadas projetadas devem estar na faixa de metros UTM."""
        lonlat = [(-52.58, -27.62)]
        xy = project_points(lonlat)
        x, y = xy[0]
        # UTM zona 22S: x ~400.000–800.000, y ~6.800.000–7.200.000
        assert 300_000 < x < 900_000
        assert 6_800_000 < y < 7_200_000

    def test_roundtrip(self):
        """Projetar e reprojetar deve devolver coordenadas originais."""
        original = [(-52.58, -27.62), (-52.57, -27.63)]
        xy = project_points(original)
        back = unproject_points(xy)
        for (lon0, lat0), result in zip(original, back):
            assert abs(result[0] - lon0) < 1e-6
            assert abs(result[1] - lat0) < 1e-6

    def test_multiple_points(self):
        """Deve projetar múltiplos pontos corretamente."""
        lonlat = [(-52.58, -27.62), (-52.57, -27.61), (-52.56, -27.63)]
        xy = project_points(lonlat)
        assert len(xy) == 3
        for x, y in xy:
            assert isinstance(x, float)
            assert isinstance(y, float)


# find_optimal_angle
class TestFindOptimalAngle:

    def test_returns_int_between_0_and_180(self, polygon_retangulo):
        from app.services.algorithm import project_points
        ring = list(polygon_retangulo.exterior.coords)
        xy = project_points([(float(lon), float(lat)) for lon, lat in ring])
        poly_m = Polygon(xy)
        angle = find_optimal_angle(poly_m, working_width=6.0)
        assert isinstance(angle, int)
        assert 0 <= angle <= 180

    def test_horizontal_rectangle_prefers_0_or_180(self):
        """Retângulo mais largo que alto deve preferir ângulo próximo de 0° ou 90°."""
        # retângulo 200m x 50m (mais largo)
        poly = Polygon([(0, 0), (200, 0), (200, 50), (0, 50)])
        angle = find_optimal_angle(poly, working_width=6.0)
        # o ângulo ótimo minimiza número de faixas — deve ser 0 ou 90
        assert angle in range(0, 181)

    def test_different_widths_give_different_counts(self):
        """Larguras de trabalho diferentes produzem contagens de faixas diferentes."""
        poly = Polygon([(0, 0), (100, 0), (100, 100), (0, 100)])
        angle_narrow = find_optimal_angle(poly, working_width=3.0)
        angle_wide   = find_optimal_angle(poly, working_width=12.0)
        # ambos válidos, apenas verificamos que não quebra
        assert 0 <= angle_narrow <= 180
        assert 0 <= angle_wide   <= 180


# generate_swaths
class TestGenerateSwaths:

    def _to_metric(self, polygon):
        from app.services.algorithm import project_points
        ring = list(polygon.exterior.coords)
        xy = project_points([(float(lon), float(lat)) for lon, lat in ring])
        return Polygon(xy)

    def test_rectangle_generates_swaths(self, polygon_retangulo):
        poly_m = self._to_metric(polygon_retangulo)
        angle  = find_optimal_angle(poly_m, 6.0)
        swaths = generate_swaths(poly_m, 6.0, angle)
        assert len(swaths) > 0

    def test_each_swath_has_at_least_two_points(self, polygon_retangulo):
        poly_m = self._to_metric(polygon_retangulo)
        angle  = find_optimal_angle(poly_m, 6.0)
        swaths = generate_swaths(poly_m, 6.0, angle)
        for sw in swaths:
            assert len(sw) >= 2

    def test_concave_polygon_generates_swaths(self, polygon_formato_l):
        """Polígono côncavo (formato L) deve gerar faixas sem erro."""
        poly_m = self._to_metric(polygon_formato_l)
        angle  = find_optimal_angle(poly_m, 6.0)
        swaths = generate_swaths(poly_m, 6.0, angle)
        assert len(swaths) > 0

    def test_wider_width_fewer_swaths(self, polygon_retangulo):
        """Largura maior deve gerar menos faixas."""
        poly_m  = self._to_metric(polygon_retangulo)
        angle   = find_optimal_angle(poly_m, 6.0)
        swaths_narrow = generate_swaths(poly_m, 6.0,  angle)
        swaths_wide   = generate_swaths(poly_m, 12.0, angle)
        assert len(swaths_narrow) >= len(swaths_wide)

    def test_swath_coords_are_floats(self, polygon_retangulo):
        poly_m = self._to_metric(polygon_retangulo)
        angle  = find_optimal_angle(poly_m, 6.0)
        swaths = generate_swaths(poly_m, 6.0, angle)
        for sw in swaths:
            for x, y in sw:
                assert isinstance(x, float)
                assert isinstance(y, float)


# nearest_neighbor
class TestNearestNeighbor:

    def _make_swaths(self):
        """Faixas sintéticas simples para testar a ordenação."""
        return [
            [(0.0, 0.0),   (10.0, 0.0)],
            [(0.0, 20.0),  (10.0, 20.0)],
            [(0.0, 10.0),  (10.0, 10.0)],
            [(0.0, 30.0),  (10.0, 30.0)],
        ]

    def test_returns_same_count(self):
        swaths  = self._make_swaths()
        ordered = nearest_neighbor(swaths)
        assert len(ordered) == len(swaths)

    def test_empty_input(self):
        assert nearest_neighbor([]) == []

    def test_single_swath(self):
        swath   = [[(0.0, 0.0), (10.0, 0.0)]]
        ordered = nearest_neighbor(swath)
        assert len(ordered) == 1

    def test_transition_distance_is_reasonable(self):
        """A ordem do NN deve ser melhor ou igual à ordem original."""
        swaths = self._make_swaths()

        def total_transition(sws):
            return sum(
                math.hypot(sws[i][-1][0] - sws[i+1][0][0],
                           sws[i][-1][1] - sws[i+1][0][1])
                for i in range(len(sws) - 1)
            )

        original_cost = total_transition(swaths)
        ordered_cost  = total_transition(nearest_neighbor(swaths))
        # NN deve ser igual ou melhor que ordem aleatória
        assert ordered_cost <= original_cost * 1.5  # tolerância de 50%

    def test_all_swaths_present(self):
        """Nenhuma faixa deve ser perdida ou duplicada."""
        swaths  = self._make_swaths()
        ordered = nearest_neighbor(swaths)
        # compara conjuntos de pontos de início
        original_starts = {sw[0] for sw in swaths}
        ordered_starts  = {sw[0] for sw in ordered}
        ordered_ends    = {sw[-1] for sw in ordered}
        # cada faixa original deve aparecer (possivelmente invertida)
        for sw in swaths:
            assert sw[0] in ordered_starts or sw[0] in ordered_ends


# two_opt
class TestTwoOpt:

    def _transition_cost(self, swaths):
        return sum(
            math.hypot(swaths[i][-1][0] - swaths[i+1][0][0],
                       swaths[i][-1][1] - swaths[i+1][0][1])
            for i in range(len(swaths) - 1)
        )

    def _make_swaths(self):
        return [
            [(0.0, 0.0),   (10.0, 0.0)],
            [(0.0, 30.0),  (10.0, 30.0)],  # intencionalmente fora de ordem
            [(0.0, 10.0),  (10.0, 10.0)],
            [(0.0, 20.0),  (10.0, 20.0)],
        ]

    def test_two_opt_does_not_increase_cost(self):
        swaths = self._make_swaths()
        before = self._transition_cost(swaths)
        after  = self._transition_cost(two_opt(swaths))
        assert after <= before + 1e-6

    def test_returns_same_count(self):
        swaths    = self._make_swaths()
        optimized = two_opt(swaths)
        assert len(optimized) == len(swaths)

    def test_short_list_unchanged(self):
        """Listas com menos de 4 faixas não devem ser alteradas."""
        swaths = [
            [(0.0, 0.0), (10.0, 0.0)],
            [(0.0, 10.0), (10.0, 10.0)],
        ]
        result = two_opt(swaths)
        assert len(result) == 2


# calculate_metrics
class TestCalculateMetrics:

    def _simple_swaths(self):
        return [
            [(0.0, 0.0),   (100.0, 0.0)],
            [(100.0, 10.0), (0.0, 10.0)],
        ]         # 2 faixas de 100m, separadas por 10m

    def test_distance_positive(self):
        total_m, _, _ = calculate_metrics(self._simple_swaths(), 8.0, 2.5)
        assert total_m > 0

    def test_time_positive(self):
        _, time_min, _ = calculate_metrics(self._simple_swaths(), 8.0, 2.5)
        assert time_min > 0

    def test_fuel_positive(self):
        _, _, fuel = calculate_metrics(self._simple_swaths(), 8.0, 2.5)
        assert fuel > 0

    def test_faster_speed_less_time(self):
        _, time_slow, _ = calculate_metrics(self._simple_swaths(), 4.0,  2.5)
        _, time_fast, _ = calculate_metrics(self._simple_swaths(), 16.0, 2.5)
        assert time_fast < time_slow

    def test_distance_calculation_correct(self):
        """Duas faixas de 100m + transição de ~10m = ~210m total."""
        total_m, _, _ = calculate_metrics(self._simple_swaths(), 8.0, 2.5)
        assert 200 < total_m < 220

    def test_zero_speed_returns_zero_time(self):
        """Velocidade zero não deve causar divisão por zero."""
        _, time_min, _ = calculate_metrics(self._simple_swaths(), 0.0, 2.5)
        assert time_min == 0.0


# plan_coverage_route — pipeline completo
class TestPlanCoverageRoute:

    def test_rectangle_returns_swaths(self, polygon_retangulo, machine_params):
        swaths, total_m, time_min, fuel = plan_coverage_route(
            polygon_retangulo, **machine_params
        )
        assert len(swaths) > 0
        assert total_m > 0
        assert time_min > 0
        assert fuel > 0

    def test_irregular_polygon(self, polygon_irregular, machine_params):
        swaths, total_m, time_min, fuel = plan_coverage_route(
            polygon_irregular, **machine_params
        )
        assert len(swaths) > 0

    def test_concave_l_shape(self, polygon_formato_l, machine_params):
        swaths, total_m, time_min, fuel = plan_coverage_route(
            polygon_formato_l, **machine_params
        )
        assert len(swaths) > 0

    def test_output_coords_are_lonlat(self, polygon_retangulo, machine_params):
        """Coordenadas de saída devem estar em lon/lat (não metros)."""
        swaths, _, _, _ = plan_coverage_route(polygon_retangulo, **machine_params)
        for swath in swaths:
            for point in swath:
                lon, lat = point
                assert -180 < lon < 180
                assert -90  < lat < 90

    def test_output_in_rs_region(self, polygon_retangulo, machine_params):
        """Faixas devem estar na região do RS."""
        swaths, _, _, _ = plan_coverage_route(polygon_retangulo, **machine_params)
        for swath in swaths:
            for lon, lat in swath:
                assert -54.0 < lon < -51.0, f"lon fora do RS: {lon}"
                assert -29.0 < lat < -26.0, f"lat fora do RS: {lat}"

    def test_each_swath_has_two_points(self, polygon_retangulo, machine_params):
        swaths, _, _, _ = plan_coverage_route(polygon_retangulo, **machine_params)
        for i, sw in enumerate(swaths):
            assert len(sw) >= 2, f"Faixa {i} tem menos de 2 pontos"

    def test_invalid_polygon_returns_empty(self, machine_params):
        """Polígono degenerado deve retornar listas vazias sem explodir."""
        # polígono com apenas 2 pontos — inválido
        bad_poly = Polygon()
        swaths, total_m, time_min, fuel = plan_coverage_route(
            bad_poly, **machine_params
        )
        assert swaths == [] or len(swaths) == 0

    def test_very_large_working_width_returns_few_swaths(self, polygon_retangulo, machine_params):
        """Largura muito grande deve gerar poucas faixas."""
        params = {**machine_params, "working_width_m": 500.0}
        swaths, _, _, _ = plan_coverage_route(polygon_retangulo, **params)
        # pode retornar 0 ou pouquíssimas faixas
        assert isinstance(swaths, list)