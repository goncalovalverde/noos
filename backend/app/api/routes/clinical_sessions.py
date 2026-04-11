from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from typing import List

from app.db.base import get_db
from app.models.user import User
from app.schemas.clinical_session import ClinicalSessionCreate, ClinicalSessionOut
from app.auth.dependencies import get_current_active_user, require_role
from app.enums import UserRole
from app.services.clinical_session_service import ClinicalSessionService

router = APIRouter(
    prefix="/api/plans/{plan_id}/sessions",
    tags=["clinical-sessions"],
)


@router.post("/", response_model=ClinicalSessionOut, status_code=201)
async def create_session(
    plan_id: str,
    body: ClinicalSessionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.NEURO)),
):
    return ClinicalSessionService(db).create(plan_id, body, current_user, request)


@router.get("/", response_model=List[ClinicalSessionOut])
async def list_sessions(
    plan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return ClinicalSessionService(db).list(plan_id, current_user)


@router.get("/{session_id}", response_model=ClinicalSessionOut)
async def get_session(
    plan_id: str,
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return ClinicalSessionService(db).get(plan_id, session_id, current_user)


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    plan_id: str,
    session_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.NEURO)),
):
    ClinicalSessionService(db).delete(plan_id, session_id, current_user, request)
