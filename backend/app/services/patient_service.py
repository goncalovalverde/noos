from fastapi import HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from app.models.patient import Patient
from app.models.patient_access import PatientAccess
from app.models.test_session import TestSession
from app.models.user import User
from app.schemas.patient import PatientCreate, PatientUpdate, PatientOut
from app.api.utils.access import can_access_patient
from app.api.utils.audit import audit


class PatientService:
    def __init__(self, db: Session):
        self.db = db

    def list_patients(self, user: User, page: int = 1, size: int = 20) -> List[PatientOut]:
        q = self.db.query(Patient)
        if user.role != "Administrador":
            granted_ids = self.db.query(PatientAccess.patient_id).filter(PatientAccess.user_id == user.id)
            q = q.filter(or_(
                Patient.created_by_id == None,  # noqa: E711
                Patient.created_by_id == user.id,
                Patient.id.in_(granted_ids),
            ))
        offset = (page - 1) * size
        patients = q.order_by(Patient.created_at.desc()).offset(offset).limit(size).all()
        result = []
        for p in patients:
            out = PatientOut.model_validate(p)
            out.display_id = p.get_display_id()
            result.append(out)
        return result

    def create_patient(self, body: PatientCreate, user: User, request: Request) -> PatientOut:
        patient = Patient(**body.model_dump(), created_by_id=user.id)
        self.db.add(patient)
        self.db.flush()
        self.db.add(PatientAccess(patient_id=patient.id, user_id=user.id, granted_by_id=user.id))
        audit(self.db, "patient.create", user_id=user.id, resource_type="patient",
              resource_id=patient.id, request=request)
        self.db.commit()
        self.db.refresh(patient)
        out = PatientOut.model_validate(patient)
        out.display_id = patient.get_display_id()
        return out

    def get_patient(self, patient_id: str, user: User) -> PatientOut:
        patient = self._get_or_404(patient_id)
        self._assert_access(patient, user)
        out = PatientOut.model_validate(patient)
        out.display_id = patient.get_display_id()
        return out

    def update_patient(self, patient_id: str, body: PatientUpdate, user: User, request: Request) -> PatientOut:
        patient = self._get_or_404(patient_id)
        self._assert_access(patient, user)
        changes = body.model_dump(exclude_unset=True)
        for field, value in changes.items():
            setattr(patient, field, value)
        audit(self.db, "patient.update", user_id=user.id, resource_type="patient",
              resource_id=patient_id, details={"fields": list(changes.keys())}, request=request)
        self.db.commit()
        self.db.refresh(patient)
        out = PatientOut.model_validate(patient)
        out.display_id = patient.get_display_id()
        return out

    def delete_patient(self, patient_id: str, user: User, request: Request) -> None:
        patient = self._get_or_404(patient_id)
        self._assert_access(patient, user)
        audit(self.db, "patient.delete", user_id=user.id, resource_type="patient",
              resource_id=patient_id, details={"display_id": patient.get_display_id()}, request=request)
        self.db.delete(patient)
        self.db.commit()

    def get_access(self, patient_id: str, user: User) -> list:
        patient = self._get_or_404(patient_id)
        self._assert_access(patient, user)
        if user.role != "Administrador" and patient.created_by_id != user.id:
            raise HTTPException(403, "Solo el creador puede gestionar el acceso")
        grants = self.db.query(PatientAccess).filter(PatientAccess.patient_id == patient_id).all()
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

    def grant_access(self, patient_id: str, target_user_id: str, user: User, request: Request) -> dict:
        patient = self._get_or_404(patient_id)
        if user.role != "Administrador" and patient.created_by_id != user.id:
            raise HTTPException(403, "Solo el creador puede gestionar el acceso")
        target = self.db.query(User).filter(User.id == target_user_id).first()
        if not target:
            raise HTTPException(404, "Usuario no encontrado")
        existing = self.db.query(PatientAccess).filter(
            PatientAccess.patient_id == patient_id,
            PatientAccess.user_id == target_user_id,
        ).first()
        if not existing:
            self.db.add(PatientAccess(patient_id=patient_id, user_id=target_user_id, granted_by_id=user.id))
            audit(self.db, "patient.access.grant", user_id=user.id, resource_type="patient",
                  resource_id=patient_id, details={"granted_to": target_user_id}, request=request)
            self.db.commit()
        return {"ok": True}

    def revoke_access(self, patient_id: str, target_user_id: str, user: User, request: Request) -> None:
        patient = self._get_or_404(patient_id)
        if user.role != "Administrador" and patient.created_by_id != user.id:
            raise HTTPException(403, "Solo el creador puede gestionar el acceso")
        if target_user_id == patient.created_by_id:
            raise HTTPException(400, "No se puede revocar el acceso al creador")
        self.db.query(PatientAccess).filter(
            PatientAccess.patient_id == patient_id,
            PatientAccess.user_id == target_user_id,
        ).delete()
        audit(self.db, "patient.access.revoke", user_id=user.id, resource_type="patient",
              resource_id=patient_id, details={"revoked_from": target_user_id}, request=request)
        self.db.commit()

    def get_sessions(self, patient_id: str, user: User) -> list:
        patient = self._get_or_404(patient_id)
        self._assert_access(patient, user)
        sessions = self.db.query(TestSession).filter(
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

    # ── private helpers ────────────────────────────────────────────────────

    def _get_or_404(self, patient_id: str) -> Patient:
        patient = self.db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(404, "Paciente no encontrado")
        return patient

    def _assert_access(self, patient: Patient, user: User) -> None:
        if not can_access_patient(self.db, patient, user):
            raise HTTPException(403, "No tienes acceso a este paciente")
