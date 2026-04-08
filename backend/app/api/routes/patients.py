from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from pydantic import BaseModel
from app.db.base import get_db
from app.models.patient import Patient
from app.models.patient_access import PatientAccess
from app.models.test_session import TestSession
from app.schemas.patient import PatientCreate, PatientUpdate, PatientOut
from app.auth.dependencies import get_current_active_user, require_role
from app.models.user import User

router = APIRouter(prefix="/api/patients", tags=["patients"])


class GrantAccessBody(BaseModel):
    user_id: str


def _can_access_patient(db: Session, patient: Patient, current_user: User) -> bool:
    """Check if user can access this patient."""
    if current_user.role == "Administrador":
        return True
    if patient.created_by_id is None:  # legacy patient
        return True
    if patient.created_by_id == current_user.id:
        return True
    grant = db.query(PatientAccess).filter(
        PatientAccess.patient_id == patient.id,
        PatientAccess.user_id == current_user.id
    ).first()
    return grant is not None


@router.get("/", response_model=List[PatientOut])
async def list_patients(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    q = db.query(Patient)
    if current_user.role != "Administrador":
        granted_ids = db.query(PatientAccess.patient_id).filter(PatientAccess.user_id == current_user.id)
        q = q.filter(or_(
            Patient.created_by_id == None,  # noqa: E711
            Patient.created_by_id == current_user.id,
            Patient.id.in_(granted_ids)
        ))
    offset = (page - 1) * size
    patients = q.order_by(Patient.created_at.desc()).offset(offset).limit(size).all()
    result = []
    for p in patients:
        out = PatientOut.model_validate(p)
        out.display_id = p.get_display_id()
        result.append(out)
    return result


@router.post("/", response_model=PatientOut, status_code=201)
async def create_patient(
    body: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Administrador", "Neuropsicólogo")),
):
    patient = Patient(**body.model_dump(), created_by_id=current_user.id)
    db.add(patient)
    db.flush()
    db.add(PatientAccess(patient_id=patient.id, user_id=current_user.id, granted_by_id=current_user.id))
    db.commit()
    db.refresh(patient)
    out = PatientOut.model_validate(patient)
    out.display_id = patient.get_display_id()
    return out


@router.get("/{patient_id}/access")
async def get_patient_access(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")
    if not _can_access_patient(db, patient, current_user):
        raise HTTPException(403, "No tienes acceso a este paciente")
    if current_user.role != "Administrador" and patient.created_by_id != current_user.id:
        raise HTTPException(403, "Solo el creador puede gestionar el acceso")
    grants = db.query(PatientAccess).filter(PatientAccess.patient_id == patient_id).all()
    return [
        {
            "user_id": g.user_id,
            "username": g.user.username if g.user else "—",
            "full_name": g.user.full_name if g.user else None,
            "granted_at": g.granted_at.isoformat() if g.granted_at else None,
            "is_creator": g.user_id == patient.created_by_id,
        }
        for g in grants
    ]


@router.post("/{patient_id}/access")
async def grant_patient_access(
    patient_id: str,
    body: GrantAccessBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")
    if current_user.role != "Administrador" and patient.created_by_id != current_user.id:
        raise HTTPException(403, "Solo el creador puede gestionar el acceso")
    target = db.query(User).filter(User.id == body.user_id).first()
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    existing = db.query(PatientAccess).filter(
        PatientAccess.patient_id == patient_id,
        PatientAccess.user_id == body.user_id
    ).first()
    if not existing:
        db.add(PatientAccess(patient_id=patient_id, user_id=body.user_id, granted_by_id=current_user.id))
        db.commit()
    return {"ok": True}


@router.delete("/{patient_id}/access/{user_id}", status_code=204)
async def revoke_patient_access(
    patient_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")
    if current_user.role != "Administrador" and patient.created_by_id != current_user.id:
        raise HTTPException(403, "Solo el creador puede gestionar el acceso")
    if user_id == patient.created_by_id:
        raise HTTPException(400, "No se puede revocar el acceso al creador")
    db.query(PatientAccess).filter(
        PatientAccess.patient_id == patient_id,
        PatientAccess.user_id == user_id
    ).delete()
    db.commit()


@router.get("/{patient_id}", response_model=PatientOut)
async def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")
    if not _can_access_patient(db, patient, current_user):
        raise HTTPException(403, "No tienes acceso a este paciente")
    out = PatientOut.model_validate(patient)
    out.display_id = patient.get_display_id()
    return out


@router.put("/{patient_id}", response_model=PatientOut)
async def update_patient(
    patient_id: str,
    body: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Administrador", "Neuropsicólogo")),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")
    if not _can_access_patient(db, patient, current_user):
        raise HTTPException(403, "No tienes acceso a este paciente")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    out = PatientOut.model_validate(patient)
    out.display_id = patient.get_display_id()
    return out


@router.delete("/{patient_id}", status_code=204)
async def delete_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Administrador")),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")
    if not _can_access_patient(db, patient, current_user):
        raise HTTPException(403, "No tienes acceso a este paciente")
    db.delete(patient)
    db.commit()


@router.get("/{patient_id}/sessions")
async def get_patient_sessions(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")
    if not _can_access_patient(db, patient, current_user):
        raise HTTPException(403, "No tienes acceso a este paciente")
    sessions = db.query(TestSession).filter(
        TestSession.patient_id == patient_id
    ).order_by(TestSession.date.desc()).all()
    return [
        {
            "id": s.id,
            "test_type": s.test_type,
            "date": s.date,
            "execution_plan_id": s.execution_plan_id,
            "calculated_scores": s.get_calculated_scores(),
            "raw_data": s.get_raw_data(),
            "qualitative_data": s.get_qualitative_data(),
        }
        for s in sessions
    ]
