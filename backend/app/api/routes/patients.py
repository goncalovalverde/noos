from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from app.db.base import get_db
from app.models.user import User
from app.schemas.patient import PatientCreate, PatientUpdate, PatientOut
from app.auth.dependencies import get_current_active_user, require_role
from app.enums import UserRole
from app.services.patient_service import PatientService

router = APIRouter(prefix="/api/patients", tags=["patients"])


class GrantAccessBody(BaseModel):
    user_id: str


@router.get("/", response_model=List[PatientOut])
async def list_patients(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return PatientService(db).list_patients(current_user, page, size)


@router.post("/", response_model=PatientOut, status_code=201)
async def create_patient(
    body: PatientCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.NEURO)),
):
    return PatientService(db).create_patient(body, current_user, request)


@router.get("/{patient_id}/access")
async def get_patient_access(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return PatientService(db).get_access(patient_id, current_user)


@router.post("/{patient_id}/access")
async def grant_patient_access(
    patient_id: str,
    body: GrantAccessBody,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return PatientService(db).grant_access(patient_id, body.user_id, current_user, request)


@router.delete("/{patient_id}/access/{user_id}", status_code=204)
async def revoke_patient_access(
    patient_id: str,
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    PatientService(db).revoke_access(patient_id, user_id, current_user, request)


@router.get("/{patient_id}", response_model=PatientOut)
async def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return PatientService(db).get_patient(patient_id, current_user)


@router.put("/{patient_id}", response_model=PatientOut)
async def update_patient(
    patient_id: str,
    body: PatientUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.NEURO)),
):
    return PatientService(db).update_patient(patient_id, body, current_user, request)


@router.delete("/{patient_id}", status_code=204)
async def delete_patient(
    patient_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    PatientService(db).delete_patient(patient_id, current_user, request)


@router.get("/{patient_id}/sessions")
async def get_patient_sessions(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return PatientService(db).get_sessions(patient_id, current_user)
