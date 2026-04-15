from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from geoalchemy2 import Geometry
from app.database.database import Base


class Field(Base):
    __tablename__ = "fields"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    name = Column(String, nullable=False)
    polygon = Column(Geometry("POLYGON", srid=4326), nullable=False)  # armazena o talhão

    working_width = Column(Float, nullable=False)   # largura de trabalho em metros
    speed_kmh = Column(Float, nullable=False)        # velocidade operacional
    fuel_per_km = Column(Float, nullable=False)      # consumo L/km

    created_at = Column(DateTime, default=datetime.utcnow)

    # relacionamentos
    user = relationship("User", back_populates="fields")
    route = relationship("Route", back_populates="field", uselist=False, cascade="all,delete-orphan")