from fastapi import APIRouter

from backend.app.api.deps import CurrentUser
from backend.app.api.schemas import UserRead
from backend.app.db.models import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
def read_current_user(user: CurrentUser) -> User:
    return user
