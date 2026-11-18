from fastapi import APIRouter
from sqlalchemy import select

from backend.app.api.deps import CurrentUser, DbSession
from backend.app.api.schemas import OrganizationRead
from backend.app.db.models import Organization, OrganizationMembership

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=list[OrganizationRead])
def list_organizations(user: CurrentUser, db: DbSession) -> list[OrganizationRead]:
    rows = db.execute(
        select(Organization, OrganizationMembership.role)
        .join(OrganizationMembership, OrganizationMembership.organization_id == Organization.id)
        .where(OrganizationMembership.user_id == user.id)
        .order_by(Organization.created_at)
    ).all()
    return [
        OrganizationRead(
            id=organization.id,
            name=organization.name,
            role=role,
            created_at=organization.created_at,
        )
        for organization, role in rows
    ]
