from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import os
import secrets

import google.auth.exceptions
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from jose import JWTError, jwt
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError

from app.database.database import SessionLocal
from app.models.user_model import User
from app.schemas.user_schema import UserCreate
from app.services.user_service import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Auth"])

SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey123")
ALGORITHM = "HS256"
EXPIRE_HOURS = 24
GOOGLE_CLIENT_ID = os.getenv(
    "GOOGLE_CLIENT_ID",
    "122293862526-ii0t0bra2cru5p3ag96fgdj2r51ruv8k.apps.googleusercontent.com",
).strip()


class GoogleLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    credential: str = Field(min_length=1, max_length=8192)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _create_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=EXPIRE_HOURS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def _verify_google_credential(credential: str) -> dict:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Login com Google não está configurado.",
        )

    try:
        unverified_claims = jwt.get_unverified_claims(credential)
    except JWTError:
        unverified_claims = {}

    token_audience = unverified_claims.get("aud")
    token_audiences = (
        token_audience if isinstance(token_audience, list) else [token_audience]
    )
    if token_audience is not None and GOOGLE_CLIENT_ID not in token_audiences:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "O Client ID configurado no backend é diferente do Client ID "
                "que gerou a credencial do Google."
            ),
        )

    try:
        claims = id_token.verify_oauth2_token(
            credential,
            GoogleRequest(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credencial do Google inválida ou expirada.",
        ) from error
    except google.auth.exceptions.GoogleAuthError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível validar a conta Google agora.",
        ) from error

    if (
        claims.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}
        or claims.get("email_verified") is not True
        or not isinstance(claims.get("email"), str)
        or not claims["email"].strip()
        or not isinstance(claims.get("sub"), str)
        or not claims["sub"]
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A conta Google não possui um e-mail verificado válido.",
        )
    return claims


#POST /auth/register
@router.post("/register", status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    user = User(email=payload.email, password=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"id": user.id, "email": user.email}


#POST /auth/login
@router.post("/login")
def login(payload: UserCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")

    token = _create_token(user.id)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/google")
def google_login(
    payload: GoogleLoginRequest,
    db: Session = Depends(get_db),
):
    claims = _verify_google_credential(payload.credential)
    email = claims["email"].strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(
            email=email,
            password=hash_password(secrets.token_urlsafe(32)),
        )
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
        except IntegrityError:
            db.rollback()
            user = db.query(User).filter(User.email == email).first()
            if user is None:
                raise

    return {
        "access_token": _create_token(user.id),
        "token_type": "bearer",
    }