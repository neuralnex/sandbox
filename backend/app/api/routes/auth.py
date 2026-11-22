from typing import Any
import hashlib
import re

import httpx
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from backend.app.api.deps import DbSession, FirebaseIdentity
from backend.app.api.schemas import (
    FirebaseTokenRead,
    FirebaseRefreshInput,
    LoginInput,
    ProfileSyncInput,
    RegisterInput,
    UserRead,
)
from backend.app.core.config import settings
from backend.app.db.models import Organization, OrganizationMembership, User

router = APIRouter(prefix="/auth", tags=["authentication"])
IDENTITY_TOOLKIT_URL = "https://identitytoolkit.googleapis.com/v1/accounts"
SECURE_TOKEN_URL = "https://securetoken.googleapis.com/v1/token"


async def _firebase_password_request(
    operation: str, email: str, password: str
) -> dict[str, Any]:
    if (
        not settings.firebase_web_api_key
        or not settings.firebase_web_api_key.get_secret_value()
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase password authentication is not configured",
        )
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{IDENTITY_TOOLKIT_URL}:{operation}",
                params={"key": settings.firebase_web_api_key.get_secret_value()},
                json={"email": email, "password": password, "returnSecureToken": True},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase Authentication could not be reached",
        ) from exc

    if response.is_success:
        return response.json()

    try:
        firebase_error = response.json().get("error", {}).get("message", "")
    except ValueError:
        firebase_error = ""
    if firebase_error == "EMAIL_EXISTS":
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    if firebase_error in {"EMAIL_NOT_FOUND", "INVALID_PASSWORD", "INVALID_LOGIN_CREDENTIALS"}:
        raise HTTPException(status_code=401, detail="Incorrect username/email or password")
    if firebase_error.startswith("TOO_MANY_ATTEMPTS_TRY_LATER"):
        raise HTTPException(status_code=429, detail="Too many sign-in attempts; try again later")
    if firebase_error == "USER_DISABLED":
        raise HTTPException(status_code=403, detail="This Firebase account has been disabled")
    if firebase_error == "OPERATION_NOT_ALLOWED":
        raise HTTPException(
            status_code=503, detail="Email and password sign-in is not enabled in Firebase"
        )
    if firebase_error.startswith("WEAK_PASSWORD"):
        raise HTTPException(status_code=422, detail="Password does not meet Firebase requirements")
    raise HTTPException(status_code=502, detail="Firebase Authentication rejected the request")


def _create_profile(
    db: DbSession,
    firebase_uid: str,
    email: str | None,
    username: str,
    workspace_name: str | None,
) -> User:
    username = username.lower()
    if db.scalar(select(User.id).where(User.username == username)) is not None:
        raise HTTPException(status_code=409, detail="This username is already taken")
    if email and db.scalar(select(User.id).where(User.email == email.lower())) is not None:
        raise HTTPException(
            status_code=409,
            detail="This email is already linked to a Sandbox profile; sign in with that provider",
        )

    user = User(firebase_uid=firebase_uid, username=username, email=email.lower() if email else None)
    workspace = Organization(name=workspace_name or f"{username}'s workspace")
    db.add_all([user, workspace])
    try:
        db.flush()
    except IntegrityError as exc:
        # The Firebase state observer and the sign-in handler can sync the
        # same identity concurrently. Treat the winning insert as success.
        db.rollback()
        existing = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
        if existing is not None:
            return existing
        raise HTTPException(
            status_code=409,
            detail="An account with this username or email already exists",
        ) from exc
    db.add(OrganizationMembership(organization_id=workspace.id, user_id=user.id, role="owner"))
    db.commit()
    db.refresh(user)
    return user


def _suggest_username(identity: dict[str, Any], firebase_uid: str) -> str:
    """Create a stable, collision-resistant handle for first-time social sign-ins."""
    email = identity.get("email") or ""
    display_name = identity.get("name") or email.partition("@")[0] or "member"
    stem = re.sub(r"[^a-z0-9_]+", "_", display_name.lower()).strip("_") or "member"
    suffix = hashlib.sha256(firebase_uid.encode("utf-8")).hexdigest()[:8]
    return f"{stem[:23]}_{suffix}"


def _firebase_token_response(result: dict[str, Any]) -> FirebaseTokenRead:
    return FirebaseTokenRead(
        id_token=result["idToken"],
        refresh_token=result["refreshToken"],
        expires_in=int(result["expiresIn"]),
    )


@router.post("/refresh", response_model=FirebaseTokenRead)
async def refresh_token(payload: FirebaseRefreshInput) -> FirebaseTokenRead:
    if not settings.firebase_web_api_key or not settings.firebase_web_api_key.get_secret_value():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase password authentication is not configured",
        )
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                SECURE_TOKEN_URL,
                params={"key": settings.firebase_web_api_key.get_secret_value()},
                data={"grant_type": "refresh_token", "refresh_token": payload.refresh_token},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase Authentication could not be reached",
        ) from exc
    if not response.is_success:
        raise HTTPException(status_code=401, detail="Firebase session expired; sign in again")
    result = response.json()
    return FirebaseTokenRead(
        id_token=result["id_token"],
        refresh_token=result["refresh_token"],
        expires_in=int(result["expires_in"]),
    )


@router.post("/register", response_model=FirebaseTokenRead, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterInput, db: DbSession) -> FirebaseTokenRead:
    username = payload.username.lower()
    email = str(payload.email).lower()
    matching_email_user = db.scalar(select(User).where(User.email == email))
    if matching_email_user is not None and matching_email_user.firebase_uid is not None:
        raise HTTPException(status_code=409, detail="This email is already linked to a Sandbox profile")
    username_query = select(User.id).where(User.username == username)
    if matching_email_user is not None:
        username_query = username_query.where(User.id != matching_email_user.id)
    username_owner = db.scalar(username_query)
    if username_owner is not None:
        raise HTTPException(status_code=409, detail="This username is already taken")

    result = await _firebase_password_request("signUp", email, payload.password)
    if matching_email_user is None:
        _create_profile(
            db,
            firebase_uid=result["localId"],
            email=result.get("email", email),
            username=username,
            workspace_name=payload.workspace_name,
        )
    # Existing legacy accounts are linked by /auth/sync only after Firebase
    # reports the account email as verified.
    return _firebase_token_response(result)


@router.post("/login", response_model=FirebaseTokenRead)
async def login(payload: LoginInput, db: DbSession) -> FirebaseTokenRead:
    identifier = payload.identifier.strip()
    if "@" in identifier:
        email = identifier.lower()
    else:
        email = db.scalar(select(User.email).where(User.username == identifier.lower()))
        if email is None:
            raise HTTPException(status_code=401, detail="Incorrect username/email or password")
    result = await _firebase_password_request("signInWithPassword", email, payload.password)
    return _firebase_token_response(result)


@router.post("/sync", response_model=UserRead)
def sync_profile(
    payload: ProfileSyncInput,
    identity: FirebaseIdentity,
    db: DbSession,
) -> User:
    firebase_uid = identity["uid"]
    email = identity.get("email")
    user = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
    if user is not None:
        if email and identity.get("email_verified") and user.email != email.lower():
            conflicting_user = db.scalar(
                select(User.id).where(User.email == email.lower(), User.id != user.id)
            )
            if conflicting_user is None:
                user.email = email.lower()
                db.commit()
                db.refresh(user)
        return user

    # Link a pre-Firebase Sandbox account by its already verified email so its
    # existing projects and experiments remain attached to the same user row.
    if email:
        legacy_user = db.scalar(
            select(User).where(User.email == email.lower(), User.firebase_uid.is_(None))
        )
        if legacy_user is not None:
            if identity.get("email_verified") is not True:
                raise HTTPException(
                    status_code=403,
                    detail="Verify your email with Firebase before linking your existing account",
                )
            legacy_user.firebase_uid = firebase_uid
            # Keep the established Sandbox handle and data when linking a
            # verified Firebase identity. A supplied handle is only relevant
            # when creating a new profile.
            db.commit()
            db.refresh(legacy_user)
            return legacy_user

    return _create_profile(
        db,
        firebase_uid=firebase_uid,
        email=email,
        username=payload.username or _suggest_username(identity, firebase_uid),
        workspace_name=payload.workspace_name,
    )
