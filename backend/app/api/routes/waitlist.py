from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.api.deps import CurrentUser
from backend.app.core.config import settings
from backend.app.db.models import User, WaitlistSignup
from backend.app.db.session import get_db

router = APIRouter(prefix="/waitlist", tags=["waitlist"])


class WaitlistSignupInput(BaseModel):
    email: EmailStr
    source: str = Field(default="landing_page", max_length=80)
    website: str = Field(default="", max_length=200)


class WaitlistSignupRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    email: EmailStr
    source: str
    created_at: datetime


class WaitlistAdminRead(BaseModel):
    total: int
    limit: int
    offset: int
    entries: list[WaitlistSignupRead]


def require_waitlist_admin(user: CurrentUser) -> User:
    allowed_emails = {email.strip().lower() for email in settings.waitlist_admin_emails if email.strip()}
    if not user.email or user.email.lower() not in allowed_emails:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Waitlist admin access is not enabled for this account")
    return user


@router.post("", status_code=200)
def join_waitlist(payload: WaitlistSignupInput, db: Session = Depends(get_db)) -> dict[str, str]:
    # Honeypot submissions receive the same response without being stored.
    if payload.website:
        return {"message": "Thanks for your interest. You are on the Sandbox waitlist."}

    email = str(payload.email).strip().lower()
    if db.query(WaitlistSignup).filter(WaitlistSignup.email == email).first() is None:
        db.add(WaitlistSignup(email=email, source=payload.source))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()

    return {"message": "Thanks for your interest. You are on the Sandbox waitlist."}


@router.get("/admin", response_model=WaitlistAdminRead)
def read_waitlist(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_waitlist_admin),
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> WaitlistAdminRead:
    total = db.scalar(select(func.count()).select_from(WaitlistSignup)) or 0
    entries = db.scalars(
        select(WaitlistSignup).order_by(WaitlistSignup.created_at.desc()).offset(offset).limit(limit)
    ).all()
    return WaitlistAdminRead(total=total, limit=limit, offset=offset, entries=entries)
