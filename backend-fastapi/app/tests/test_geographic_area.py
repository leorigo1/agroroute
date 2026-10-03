import pytest

from app.services.geographic_area import calculate_polygon_area


def test_calculates_area_in_square_meters_and_hectares(coords_retangulo):
    result = calculate_polygon_area(coords_retangulo)

    assert result["area_m2"] > 0
    assert result["area_hectares"] == pytest.approx(result["area_m2"] / 10_000)
    assert result["area_hectares"] == pytest.approx(27, rel=0.2)


def test_calculates_small_polygon_without_rounding_internally():
    coordinates = [
        [-46.0, -23.0],
        [-45.9999, -23.0],
        [-45.9999, -22.9999],
        [-46.0, -22.9999],
    ]

    result = calculate_polygon_area(coordinates)

    assert 0 < result["area_hectares"] < 1
    assert result["area_hectares"] == result["area_m2"] / 10_000


def test_calculates_large_polygon():
    coordinates = [
        [-47.0, -24.0],
        [-46.9, -24.0],
        [-46.9, -23.9],
        [-47.0, -23.9],
    ]

    result = calculate_polygon_area(coordinates)

    assert result["area_hectares"] > 100
    assert result["area_hectares"] == result["area_m2"] / 10_000


@pytest.mark.parametrize(
    "coordinates",
    [
        [[0.0, 0.0], [1.0, 1.0]],
        [[0.0, 0.0], [1.0, 1.0], [0.0, 1.0], [1.0, 0.0]],
        [[0.0, 0.0, 0.0], [1.0, 1.0], [0.0, 1.0]],
        [[181.0, 0.0], [1.0, 1.0], [0.0, 1.0]],
        [[0.0, 91.0], [1.0, 1.0], [0.0, 1.0]],
    ],
)
def test_rejects_invalid_polygons(coordinates):
    with pytest.raises(ValueError):
        calculate_polygon_area(coordinates)


def test_create_field_returns_area_of_original_selection(coords_retangulo):
    from types import SimpleNamespace

    from app.api.field_routes import create_field
    from app.schemas.field_schema import FieldCreate

    class FakeSession:
        field = None

        def add(self, field):
            self.field = field

        def commit(self):
            pass

        def refresh(self, field):
            field.id = 17

    planning_coordinates = [
        [-52.5801, -27.6201],
        [-52.5751, -27.6201],
        [-52.5751, -27.6251],
        [-52.5801, -27.6251],
    ]
    payload = FieldCreate(
        name="Talhão teste",
        coordinates=planning_coordinates,
        original_coordinates=coords_retangulo,
        working_width=6,
        speed_kmh=8,
        fuel_lph=2.5,
    )

    response = create_field(
        payload,
        db=FakeSession(),
        user=SimpleNamespace(id=1),
    )

    original_area = calculate_polygon_area(coords_retangulo)
    planning_area = calculate_polygon_area(planning_coordinates)
    assert response["area_m2"] == original_area["area_m2"]
    assert response["area_m2"] != planning_area["area_m2"]
    assert response["area_hectares"] == original_area["area_hectares"]
