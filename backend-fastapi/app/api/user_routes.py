from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.models.user_model import User
from passlib.context import CryptContext

router = APIRouter(prefix="/users", tags=["Users"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    return pwd_context.hash(password)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 👤 criar usuário
@router.post("/")
def create_user(email: str, password: str, db: Session = Depends(get_db)):

    hashed = hash_password(password)

    user = User(email=email, password=hashed)

    db.add(user)
    db.commit()
    db.refresh(user)

    return {"id": user.id, "email": user.email}

# 📄 listar usuários
@router.get("/")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).all()

    return [
        {"id": u.id, "email": u.email}
        for u in users
    ]