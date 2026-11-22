from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from backend.app.api.deps import CurrentUser, DbSession
from backend.app.api.schemas import OrganizationRead, OrganizationUpdate
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
            business_type=organization.business_type,
            country=organization.country,
            region=organization.region,
            city=organization.city,
            timezone=organization.timezone,
            latitude=organization.latitude,
            longitude=organization.longitude,
            role=role,
            created_at=organization.created_at,
        )
        for organization, role in rows
    ]


@router.patch("/{organization_id}", response_model=OrganizationRead)
def update_organization(
    organization_id: UUID,
    payload: OrganizationUpdate,
    user: CurrentUser,
    db: DbSession,
) -> OrganizationRead:
    row = db.execute(
        select(Organization, OrganizationMembership.role)
        .join(OrganizationMembership, OrganizationMembership.organization_id == Organization.id)
        .where(
            Organization.id == organization_id,
            OrganizationMembership.user_id == user.id,
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    organization, role = row
    if role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Only workspace owners and admins can edit settings")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(organization, field, value)
    db.commit()
    db.refresh(organization)
    return OrganizationRead(
        id=organization.id,
        name=organization.name,
        business_type=organization.business_type,
        country=organization.country,
        region=organization.region,
        city=organization.city,
        timezone=organization.timezone,
        latitude=organization.latitude,
        longitude=organization.longitude,
        role=role,
        created_at=organization.created_at,
    )
