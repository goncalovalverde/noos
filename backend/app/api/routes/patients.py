from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from app.db.base import get_db
from app.models.patient import Patient
from app.models.test_session import TestSession
from app.schemas.patient import PatientCreate, PatientUpdate, PatientOut
from app.auth.dependencies import get_current_active_user, require_role
from app.models.user import User

router = APIRouter(prefix="/api/patients", tags=["patients"])

@router.get("/", response_model=List[PatientOut])
async def list_patients(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    offset = (page - 1) * size
    patients = db.query(Patient).order_by(Patient.created_at.desc()).offset(offset).limit(size).all()
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
    patient = Patient(**body.model_dump())
    db.add(patient)
    db.commit()
    db.refresh(patient)
    out = PatientOut.model_validate(patient)
    out.display_id = patient.get_display_id()
    return out

@router.get("/{patient_id}", response_model=PatientOut)
async def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")
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
    sessions = db.query(TestSession).filter(
        TestSession.patient_id == patient_id
    ).order_by(TestSession.date.desc()).all()
    return [
        {
            "id": s.id,
            "test_type": s.test_type,
            "date": s.date,
            "calculated_scores": s.get_calculated_scores(),
            "raw_data": s.get_raw_data(),
        }
        for s in sessions
    ]
