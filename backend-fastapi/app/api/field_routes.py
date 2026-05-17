from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import Polygon
from app.database.database import SessionLocal
from app.models.user_model import User
from app.models.field_model import Field
from app.models.routes_model import Route
from app.schemas.field_schema import FieldCreate, FieldOut, FieldDetail, RouteOut
from app.services.algorithm import plan_coverage_route
from app.services.user_service import verify_password
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

import os

router = APIRouter(prefix="/fields", tags=["Fields"])

SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey123")
ALGORITHM = "HS256"


#dependência de sessão
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


#dependência de autenticação
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user


#helper: converte coordenadas em Poli'gons
def _to_polygon(coords: list[list[float]]) -> Polygon:
    if len(coords) < 3:
        raise HTTPException(status_code=422, detail="Polígono precisa de pelo menos 3 pontos")
    ring = [(float(lon), float(lat)) for lon, lat in coords]
    if ring[0] != ring[-1]:
        ring.append(ring[0])  # fecha o anel
    poly = Polygon(ring)
    if not poly.is_valid:
        poly = poly.buffer(0)
    if poly.is_empty:
        raise HTTPException(status_code=422, detail="Polígono inválido")
    return poly


#POST /fields - salva talhão 
@router.post("/", response_model=FieldOut, status_code=201)
def create_field(
    payload: FieldCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    polygon = _to_polygon(payload.coordinates)

    field = Field(
        user_id=user.id,
        name=payload.name,
        polygon=from_shape(polygon, srid=4326),
        working_width=payload.working_width,
        speed_kmh=payload.speed_kmh,
        fuel_per_km=payload.fuel_per_km,
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


#GET /fields - lista talhões do usuário 
@router.get("/", response_model=list[FieldOut])
def list_fields(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(Field).filter(Field.user_id == user.id).order_by(Field.id.desc()).all()


#GET /fields/{id} - detalhe do talhão 
@router.get("/{field_id}", response_model=FieldDetail)
def get_field(
    field_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    field = db.query(Field).filter(Field.id == field_id, Field.user_id == user.id).first()
    if field is None:
        raise HTTPException(status_code=404, detail="Talhão não encontrado")

    poly = to_shape(field.polygon)
    coords = [[float(lon), float(lat)] for lon, lat in poly.exterior.coords]

    return FieldDetail(
        id=field.id,
        name=field.name,
        working_width=field.working_width,
        speed_kmh=field.speed_kmh,
        fuel_per_km=field.fuel_per_km,
        coordinates=coords,
    )


#POST /fields/{id}/calculate - rodar algoritmo 
@router.post("/{field_id}/calculate", response_model=RouteOut)
def calculate_route(
    field_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    field = db.query(Field).filter(Field.id == field_id, Field.user_id == user.id).first()
    if field is None:
        raise HTTPException(status_code=404, detail="Talhão não encontrado")

    polygon = to_shape(field.polygon)

    #roda o algoritmo
    swaths, total_m, time_min, fuel_liters = plan_coverage_route(
        polygon,
        working_width_m=field.working_width,
        speed_kmh=field.speed_kmh,
        fuel_lph=field.fuel_per_km,
    )

    if not swaths:
        raise HTTPException(status_code=422, detail="Não foi possível gerar faixas para este talhão")

    #salva ou atualiza a rota
    route = db.query(Route).filter(Route.field_id == field.id).first()
    if route is None:
        route = Route(
            field_id=field.id,
            swaths=swaths,
            total_distance_m=total_m,
            estimated_time_min=time_min,
            estimated_fuel_liters=fuel_liters,
        )
        db.add(route)
    else:
        route.swaths = swaths
        route.total_distance_m = total_m
        route.estimated_time_min = time_min
        route.estimated_fuel_liters = fuel_liters

    db.commit()
    db.refresh(route)

    return RouteOut(
        swaths=route.swaths,
        total_distance_m=route.total_distance_m,
        estimated_time_min=route.estimated_time_min,
        estimated_fuel_liters=route.estimated_fuel_liters,
    )


#GET /fields/{id}/route ─ buscar rota salva
@router.get("/{field_id}/route", response_model=RouteOut)
def get_route(
    field_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    field = db.query(Field).filter(Field.id == field_id, Field.user_id == user.id).first()
    if field is None:
        raise HTTPException(status_code=404, detail="Talhão não encontrado")

    route = db.query(Route).filter(Route.field_id == field.id).first()
    if route is None:
        raise HTTPException(status_code=404, detail="Rota não calculada ainda")

    return RouteOut(
        swaths=route.swaths,
        total_distance_m=route.total_distance_m,
        estimated_time_min=route.estimated_time_min,
        estimated_fuel_liters=route.estimated_fuel_liters,
    )

@router.delete("/{field_id}", status_code=204)
def delete_field(
    field_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    field = db.query(Field).filter(Field.id == field_id, Field.user_id == user.id).first()
    if field is None:
        raise HTTPException(status_code=404, detail="Talhão não encontrado")

    db.delete(field)
    db.commit()