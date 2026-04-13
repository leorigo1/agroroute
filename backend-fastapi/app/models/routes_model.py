from datetime import datetime
from sqlalchemy import Column, Integer, Float, ForeignKey, DateTime, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship 
from geoalchemy2 import Geometry
from app.database.database import Base

class Route(Base):
    __tablename__ = "rotas"

    id = Column(Integer,primary_key=True, index=True)
    geom = Column(Geometry("LINESTRING"))

    field_id = Column(Integer, ForeignKey("fields.id"), nullable=False, unique=True, index=True)
 
    # lista de faixas: [[[lon, lat], [lon, lat]], ...] — uma lista por swath
    swaths = Column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
 
    total_distance_m = Column(Float, nullable=False)
    estimated_time_min = Column(Float, nullable=False)
    estimated_fuel_liters = Column(Float, nullable=False)
 
    created_at = Column(DateTime, default=datetime.utcnow)
 
    # relacionamento
    field = relationship("Field", back_populates="route")
 