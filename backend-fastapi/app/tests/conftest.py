"""
conftest.py

Fixtures compartilhadas entre todos os testes.
O pytest carrega este arquivo automaticamente.
"""

import pytest
from shapely.geometry import Polygon
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# POLÍGONOS REUTILIZADOS EM VÁRIOS TESTES
@pytest.fixture
def coords_retangulo():
    return [
        [-52.5800, -27.6200],
        [-52.5750, -27.6200],
        [-52.5750, -27.6250],
        [-52.5800, -27.6250],
    ]

@pytest.fixture
def coords_irregular():
    return [
        [-52.5900, -27.6100],
        [-52.5860, -27.6080],
        [-52.5820, -27.6090],
        [-52.5810, -27.6130],
        [-52.5840, -27.6160],
        [-52.5890, -27.6150],
    ]

@pytest.fixture
def coords_formato_l():
    return [
        [-52.5950, -27.6200],
        [-52.5900, -27.6200],
        [-52.5900, -27.6180],
        [-52.5870, -27.6180],
        [-52.5870, -27.6140],
        [-52.5830, -27.6140],
        [-52.5830, -27.6220],
        [-52.5870, -27.6220],
        [-52.5870, -27.6210],
        [-52.5900, -27.6210],
        [-52.5900, -27.6230],
        [-52.5950, -27.6230],
    ]

@pytest.fixture
def polygon_retangulo(coords_retangulo):
    return Polygon([(lon, lat) for lon, lat in coords_retangulo])

@pytest.fixture
def polygon_irregular(coords_irregular):
    return Polygon([(lon, lat) for lon, lat in coords_irregular])

@pytest.fixture
def polygon_formato_l(coords_formato_l):
    return Polygon([(lon, lat) for lon, lat in coords_formato_l])

# PARÂMETROS DE MÁQUINA PADRÃO
@pytest.fixture
def machine_params():
    return {
        "working_width_m": 6.0,
        "speed_kmh": 8.0,
        "fuel_per_km": 2.5,
    }