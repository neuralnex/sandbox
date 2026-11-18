from typing import Annotated, Any
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.firebase import verify_firebase_id_token
from backend.app.db.models import OrganizationMembership, User
from backend.app.db.session import get_db

bearer_scheme = HTTPBearer()
DbSession = Annotated[Session, Depends(get_db)]


def get_firebase_identity(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> dict[str, Any]:
    return verify_firebase_id_token(credentials.credentials)


FirebaseIdentity = Annotated[dict[str, Any], Depends(get_firebase_identity)]


def get_current_user(identity: FirebaseIdentity, db: DbSession) -> User:
    firebase_uid = identity.get("uid")
    user = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Complete profile setup before accessing Sandbox",
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_organization_membership(db: Session, user_id: UUID, organization_id: UUID) -> bool:
    return db.scalar(
        select(OrganizationMembership.id).where(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.user_id == user_id,
        )
    ) is not None
