from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.routes import router as main_router
from app.api.user_routes import router as user_router
from app.api.auth_routes import router as auth_router
from app.api.field_routes import router as field_router

from app.database.database import engine, wait_for_db
from app.database.database import Base

import app.models.user_model
import app.models.field_model
import app.models.routes_model

import os


app = FastAPI(title="AgroRoute API", root_path="/api")

configured_frontend_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
]
frontend_origins = list(
    dict.fromkeys(
        [
            "http://localhost:3000",
            "https://agroroute.vercel.app",
            *configured_frontend_origins,
        ]
    )
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 📌 registrar rotas
app.include_router(main_router)
app.include_router(user_router)
app.include_router(auth_router)
app.include_router(field_router)


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
    print("Tabelas criadas com sucesso! Beijos leo")