from pydantic import BaseModel


# --- entrada ao criar um talhão ---
class FieldCreate(BaseModel):
    name: str
    coordinates: list[list[float]]  # [[lon, lat], [lon, lat], ...]
    working_width: float             # metros
    speed_kmh: float
    fuel_per_km: float


# --- saída básica de um talhão ---
class FieldOut(BaseModel):
    id: int
    name: str
    working_width: float
    speed_kmh: float
    fuel_per_km: float

    class Config:
        from_attributes = True


# --- saída detalhada (inclui coordenadas do polígono) ---
class FieldDetail(FieldOut):
    coordinates: list[list[float]]


# --- saída da rota calculada ---
class RouteOut(BaseModel):
    swaths: list[list[list[float]]]   # lista de faixas, cada faixa é lista de [lon, lat]
    total_distance_m: float
    estimated_time_min: float
    estimated_fuel_liters: float