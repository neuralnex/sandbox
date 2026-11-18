from functools import lru_cache
import json
from typing import Any

import firebase_admin
from firebase_admin import credentials
from firebase_admin import auth as firebase_auth
from firebase_admin import exceptions as firebase_exceptions
from fastapi import HTTPException, status
from google.auth import exceptions as google_auth_exceptions

from backend.app.core.config import settings

SUPPORTED_SIGN_IN_PROVIDERS = {"password", "google.com", "github.com"}


@lru_cache
def get_firebase_app() -> firebase_admin.App:
    if not settings.firebase_project_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase authentication is not configured",
        )
    try:
        return firebase_admin.get_app()
    except ValueError:
        try:
            service_account_json = (
                settings.firebase_service_account_json.get_secret_value()
                if settings.firebase_service_account_json
                else ""
            )
            credential = (
                credentials.Certificate(json.loads(service_account_json))
                if service_account_json
                else credentials.ApplicationDefault()
            )
            return firebase_admin.initialize_app(
                credential=credential,
                options={"projectId": settings.firebase_project_id},
            )
        except (
            ValueError,
            firebase_exceptions.FirebaseError,
            google_auth_exceptions.DefaultCredentialsError,
        ) as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Firebase Admin credentials are unavailable",
            ) from exc


def verify_firebase_id_token(id_token: str) -> dict[str, Any]:
    try:
        claims = firebase_auth.verify_id_token(id_token, app=get_firebase_app())
    except HTTPException:
        raise
    except (ValueError, firebase_exceptions.FirebaseError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase ID token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    provider = (claims.get("firebase") or {}).get("sign_in_provider")
    if provider not in SUPPORTED_SIGN_IN_PROVIDERS:
        raise HTTPException(status_code=403, detail="This sign-in provider is not enabled")
    return claims
