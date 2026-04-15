from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def home():
    return {"message": "app funcionando"}

@router.get("/about")
def about():
    return {"message": "project build by: leo, gabi, marcelito"}
