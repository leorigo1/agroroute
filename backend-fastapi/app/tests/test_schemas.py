"""
tests/test_schemas.py

Testa as validações dos schemas Pydantic.
Não precisa de banco ou FastAPI.
"""

import pytest
from pydantic import ValidationError

from app.schemas.user_schema import UserCreate
from app.schemas.field_schema import FieldCreate, FieldOut, FieldDetail, RouteOut


# UserCreate
class TestUserCreateSchema:

    def test_valid_user(self):
        user = UserCreate(email="test@agro.com", password="senha123")
        assert user.email == "test@agro.com"
        assert user.password == "senha123"

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            UserCreate(email="not-an-email", password="senha123")

    def test_missing_email(self):
        with pytest.raises(ValidationError):
            UserCreate(password="senha123")

    def test_missing_password(self):
        with pytest.raises(ValidationError):
            UserCreate(email="test@agro.com")


# FieldCreate
class TestFieldCreateSchema:

    def _valid_payload(self):
        return {
            "name": "Talhão A",
            "coordinates": [
                [-52.58, -27.62],
                [-52.57, -27.62],
                [-52.57, -27.63],
                [-52.58, -27.63],
            ],
            "working_width": 6.0,
            "speed_kmh": 8.0,
            "fuel_per_km": 2.5,
        }

    def test_valid_field(self):
        field = FieldCreate(**self._valid_payload())
        assert field.name == "Talhão A"
        assert len(field.coordinates) == 4
        assert field.working_width == 6.0

    def test_missing_name(self):
        payload = self._valid_payload()
        del payload["name"]
        with pytest.raises(ValidationError):
            FieldCreate(**payload)

    def test_missing_coordinates(self):
        payload = self._valid_payload()
        del payload["coordinates"]
        with pytest.raises(ValidationError):
            FieldCreate(**payload)

    def test_missing_working_width(self):
        payload = self._valid_payload()
        del payload["working_width"]
        with pytest.raises(ValidationError):
            FieldCreate(**payload)

    def test_coordinates_are_list_of_pairs(self):
        field = FieldCreate(**self._valid_payload())
        for coord in field.coordinates:
            assert len(coord) == 2

    def test_numeric_params(self):
        field = FieldCreate(**self._valid_payload())
        assert isinstance(field.working_width, float)
        assert isinstance(field.speed_kmh, float)
        assert isinstance(field.fuel_per_km, float)


# RouteOut
class TestRouteOutSchema:

    def _valid_route(self):
        return {
            "swaths": [
                [[-52.58, -27.62], [-52.57, -27.62]],
                [[-52.57, -27.63], [-52.58, -27.63]],
            ],
            "total_distance_m": 850.0,
            "estimated_time_min": 6.4,
            "estimated_fuel_liters": 2.1,
        }

    def test_valid_route(self):
        route = RouteOut(**self._valid_route())
        assert len(route.swaths) == 2
        assert route.total_distance_m == 850.0

    def test_missing_swaths(self):
        payload = self._valid_route()
        del payload["swaths"]
        with pytest.raises(ValidationError):
            RouteOut(**payload)

    def test_missing_metrics(self):
        payload = self._valid_route()
        del payload["total_distance_m"]
        with pytest.raises(ValidationError):
            RouteOut(**payload)

    def test_swaths_structure(self):
        route = RouteOut(**self._valid_route())
        for swath in route.swaths:
            assert isinstance(swath, list)
            for point in swath:
                assert len(point) == 2


# FieldDetail
class TestFieldDetailSchema:

    def test_includes_coordinates(self):
        detail = FieldDetail(
            id=1,
            name="Talhão B",
            working_width=6.0,
            speed_kmh=8.0,
            fuel_per_km=2.5,
            coordinates=[[-52.58, -27.62], [-52.57, -27.62]],
        )
        assert len(detail.coordinates) == 2

    def test_missing_coordinates_fails(self):
        with pytest.raises(ValidationError):
            FieldDetail(
                id=1,
                name="Talhão B",
                working_width=6.0,
                speed_kmh=8.0,
                fuel_per_km=2.5,
            )