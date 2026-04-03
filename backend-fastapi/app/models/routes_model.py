from sqlalchemy import Column, Integer
from geoalchemy2 import Geometry
from app.database.database import Base

class Rota(Base):
    __tablename__ = "rotas"

    id = Column(Integer,primary_key=True, index=True)
    geom = Column(Geometry("LINESTRING"))