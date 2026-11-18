from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from backend.app.api.deps import CurrentUser, DbSession, require_organization_membership
from backend.app.api.schemas import ProjectCreate, ProjectRead
from backend.app.db.models import OrganizationMembership, Project

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, user: CurrentUser, db: DbSession) -> Project:
    if not require_organization_membership(db, user.id, payload.organization_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    project = Project(
        organization_id=payload.organization_id,
        created_by_id=user.id,
        name=payload.name,
        description=payload.description,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=list[ProjectRead])
def list_projects(
    user: CurrentUser,
    db: DbSession,
    organization_id: UUID | None = None,
) -> list[Project]:
    query = (
        select(Project)
        .join(OrganizationMembership, OrganizationMembership.organization_id == Project.organization_id)
        .where(OrganizationMembership.user_id == user.id)
    )
    if organization_id is not None:
        query = query.where(Project.organization_id == organization_id)
    return list(db.scalars(query.order_by(Project.created_at.desc())).all())
