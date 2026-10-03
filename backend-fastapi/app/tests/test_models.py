"""
tests/test_models.py

Testa os models SQLAlchemy usando banco PostgreSQL no docker.
"""

import os
import pytest
from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import sessionmaker

from app.database.database import Base
from app.models.user_model import User
from app.models.field_model import Field
from app.models.routes_model import Route


DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/agro_db")

@pytest.fixture(scope="module")
def engine():
    eng = create_engine(DATABASE_URL)

    with eng.connect() as connection:
        connection.execute(text("DROP TABLE IF EXISTS routes CASCADE;"))
        connection.execute(text("DROP TABLE IF EXISTS fields CASCADE;"))
        connection.execute(text("DROP TABLE IF EXISTS users CASCADE;"))
        connection.commit()    
        
    Base.metadata.create_all(bind=eng)
    return eng

@pytest.fixture
def db(engine):
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.rollback()
    session.close()


# User model
class TestUserModel:

    def test_create_user(self, db):
        user = User(email="test@agro.com", password="hashed_pw")
        db.add(user)
        db.commit()
        assert user.id is not None

    def test_email_is_stored(self, db):
        user = User(email="farmer@agro.com", password="hashed_pw")
        db.add(user)
        db.commit()
        fetched = db.query(User).filter(User.email == "farmer@agro.com").first()
        assert fetched is not None
        assert fetched.email == "farmer@agro.com"

    def test_created_at_is_set(self, db):
        user = User(email="time@agro.com", password="hashed_pw")
        db.add(user)
        db.commit()
        assert user.created_at is not None

    def test_password_is_stored(self, db):
        user = User(email="pw@agro.com", password="my_hashed_pw")
        db.add(user)
        db.commit()
        fetched = db.query(User).filter(User.email == "pw@agro.com").first()
        assert fetched.password == "my_hashed_pw"


# Field model
class TestFieldModel:

    def _create_user(self, db, email="field_user@agro.com"):
        user = User(email=email, password="hashed")
        db.add(user)
        db.commit()
        return user

    def test_create_field(self, db):
        user = self._create_user(db, "f1@agro.com")
        field = Field(
            user_id=user.id,
            name="Talhão A",
            polygon="POLYGON((-52.58 -27.62, -52.57 -27.62, -52.57 -27.63, -52.58 -27.63, -52.58 -27.62))",
            working_width=6.0,
            speed_kmh=8.0,
            fuel_lph=2.5,
        )
        db.add(field)
        db.commit()
        assert field.id is not None

    def test_field_name_stored(self, db):
        user = self._create_user(db, "f2@agro.com")
        field = Field(
            user_id=user.id,
            name="Talhão Norte",
            polygon="POLYGON((-52.58 -27.62, -52.57 -27.62, -52.57 -27.63, -52.58 -27.63, -52.58 -27.62))",
            working_width=6.0,
            speed_kmh=8.0,
            fuel_lph=2.5,
        )
        db.add(field)
        db.commit()
        fetched = db.query(Field).filter(Field.name == "Talhão Norte").first()
        assert fetched is not None
        assert fetched.name == "Talhão Norte"

    def test_field_params_stored(self, db):
        user = self._create_user(db, "f3@agro.com")
        field = Field(
            user_id=user.id,
            name="Talhão Sul",
            polygon="POLYGON((-52.58 -27.62, -52.57 -27.62, -52.57 -27.63, -52.58 -27.63, -52.58 -27.62))",
            working_width=12.0,
            speed_kmh=10.0,
            fuel_lph=3.0,
        )
        db.add(field)
        db.commit()
        fetched = db.query(Field).filter(Field.name == "Talhão Sul").first()
        assert fetched.working_width == 12.0
        assert fetched.speed_kmh == 10.0
        assert fetched.fuel_lph == 3.0

    def test_field_belongs_to_user(self, db):
        user = self._create_user(db, "f4@agro.com")
        field = Field(
            user_id=user.id,
            name="Talhão Leste",
            polygon="POLYGON((-52.58 -27.62, -52.57 -27.62, -52.57 -27.63, -52.58 -27.63, -52.58 -27.62))",
            working_width=6.0,
            speed_kmh=8.0,
            fuel_lph=2.5,
        )
        db.add(field)
        db.commit()
        assert field.user_id == user.id


# Route model
class TestRouteModel:

    def _create_user_and_field(self, db, email="route_user@agro.com"):
        user = User(email=email, password="hashed")
        db.add(user)
        db.commit()
        field = Field(
            user_id=user.id,
            name="Talhão Rota",
            polygon="POLYGON((-52.58 -27.62, -52.57 -27.62, -52.57 -27.63, -52.58 -27.63, -52.58 -27.62))",
            working_width=6.0,
            speed_kmh=8.0,
            fuel_lph=2.5,
        )
        db.add(field)
        db.commit()
        return user, field

    def test_create_route(self, db):
        _, field = self._create_user_and_field(db, "r1@agro.com")
        route = Route(
            field_id=field.id,
            swaths=[[[-52.58, -27.62], [-52.57, -27.62]]],
            total_distance_m=500.0,
            estimated_time_min=4.0,
            estimated_fuel_liters=1.25,
        )
        db.add(route)
        db.commit()
        assert route.id is not None

    def test_route_metrics_stored(self, db):
        _, field = self._create_user_and_field(db, "r2@agro.com")
        route = Route(
            field_id=field.id,
            swaths=[[[-52.58, -27.62], [-52.57, -27.62]]],
            total_distance_m=1200.0,
            estimated_time_min=9.0,
            estimated_fuel_liters=3.0,
        )
        db.add(route)
        db.commit()
        fetched = db.query(Route).filter(Route.field_id == field.id).first()
        assert fetched.total_distance_m == 1200.0
        assert fetched.estimated_time_min == 9.0
        assert fetched.estimated_fuel_liters == 3.0

    def test_route_swaths_stored(self, db):
        _, field = self._create_user_and_field(db, "r3@agro.com")
        swaths = [
            [[-52.58, -27.62], [-52.57, -27.62]],
            [[-52.57, -27.63], [-52.58, -27.63]],
        ]
        route = Route(
            field_id=field.id,
            swaths=swaths,
            total_distance_m=800.0,
            estimated_time_min=6.0,
            estimated_fuel_liters=2.0,
        )
        db.add(route)
        db.commit()
        fetched = db.query(Route).filter(Route.field_id == field.id).first()
        assert len(fetched.swaths) == 2
