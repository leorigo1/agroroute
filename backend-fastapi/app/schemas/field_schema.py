from pydantic import AliasChoices, BaseModel, Field


# --- entrada ao criar um talhão ---
class FieldCreate(BaseModel):
    name: str
    coordinates: list[list[float]]  # [[lon, lat], [lon, lat], ...]
    working_width: float             # metros
    speed_kmh: float
    fuel_lph: float = Field(
        validation_alias=AliasChoices("fuel_lph", "fuel_per_km")
    )


# --- saída básica de um talhão ---
class FieldOut(BaseModel):
    id: int
    name: str
    working_width: float
    speed_kmh: float
    fuel_lph: float

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