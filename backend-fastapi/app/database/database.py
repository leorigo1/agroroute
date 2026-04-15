from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import OperationalError
import time
import psycopg2

DATABASE_URL = "postgresql://postgres:postgres@db:5432/agro_db"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True  # evita conexões mortas
)

#  sessão
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

# esperar banco subir
def wait_for_db():
    while True:
        try:
            conn = engine.connect()
            conn.close()
            print("✅ Banco conectado!")
            break
        except OperationalError:
            print("⏳ Aguardando banco...")
            time.sleep(2)