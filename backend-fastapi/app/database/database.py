from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import OperationalError
from sqlalchemy.engine import make_url
import os
import time

DATABASE_URL = make_url(
    os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@db:5432/agro_db",
    )
)
if DATABASE_URL.drivername in {"postgres", "postgresql"}:
    DATABASE_URL = DATABASE_URL.set(drivername="postgresql+psycopg2")

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
def wait_for_db(timeout_seconds: float = 30.0):
    deadline = time.monotonic() + timeout_seconds

    while True:
        try:
            conn = engine.connect()
            conn.close()
            print("✅ Banco conectado!")
            return
        except OperationalError as error:
            remaining_seconds = deadline - time.monotonic()
            if remaining_seconds <= 0:
                raise RuntimeError(
                    f"Não foi possível conectar ao banco em {timeout_seconds:g} segundos."
                ) from error

            print("⏳ Aguardando banco...")
            time.sleep(min(2, remaining_seconds))