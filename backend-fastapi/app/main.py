from fastapi import FastAPI
from sqlalchemy import text

from app.api.routes import router as main_router
from app.api.user_routes import router as user_router

from app.database.database import engine, wait_for_db
from app.models.routes_model import Base
from app.models.user_model import Base

app = FastAPI()

# 📌 registrar rotas
app.include_router(main_router)
app.include_router(user_router)

# 🚀 startup
@app.on_event("startup")
def on_startup():
    wait_for_db()

    # 🗺️ ativa PostGIS
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
        conn.commit()

    # 🧱 cria tabelas
    Base.metadata.create_all(bind=engine)