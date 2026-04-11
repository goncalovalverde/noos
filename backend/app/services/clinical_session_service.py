from datetime import date
from fastapi import HTTPException, Request
from sqlalchemy.orm import Session
import logging

from app.models.clinical_session import ClinicalSession
from app.models.execution_plan import ExecutionPlan
from app.models.test_session import TestSession
from app.models.patient import Patient
from app.models.user import User
from app.schemas.clinical_session import ClinicalSessionCreate, ClinicalSessionOut
from app.api.utils.access import can_access_patient
from app.api.utils.audit import audit

_log = logging.getLogger(__name__)


class ClinicalSessionService:
    def __init__(self, db: Session):
        self.db = db

    # ── public API ─────────────────────────────────────────────────────────

    def create(
        self, plan_id: str, body: ClinicalSessionCreate, user: User, request: Request
    ) -> ClinicalSessionOut:
        plan = self._get_plan_or_404(plan_id)
        self._check_access(plan, user)

        # Assign next sequential session_number within this plan
        existing_count = (
            self.db.query(ClinicalSession)
            .filter(ClinicalSession.execution_plan_id == plan_id)
            .count()
        )
        session_number = existing_count + 1

        cs = ClinicalSession(
            execution_plan_id=plan_id,
            session_number=session_number,
            session_date=body.session_date,
            notes=body.notes,
        )
        self.db.add(cs)
        self.db.flush()

        audit(
            self.db, "clinical_session.create",
            user_id=user.id, resource_type="clinical_session", resource_id=cs.id,
            details={"plan_id": plan_id, "session_number": session_number,
                     "session_date": str(body.session_date)},
            request=request,
        )
        self.db.commit()
        self.db.refresh(cs)
        return self._hydrate(cs)

    def list(self, plan_id: str, user: User) -> list[ClinicalSessionOut]:
        plan = self._get_plan_or_404(plan_id)
        self._check_access(plan, user)
        sessions = (
            self.db.query(ClinicalSession)
            .filter(ClinicalSession.execution_plan_id == plan_id)
            .order_by(ClinicalSession.session_number)
            .all()
        )
        return [self._hydrate(cs) for cs in sessions]

    def get(self, plan_id: str, session_id: str, user: User) -> ClinicalSessionOut:
        plan = self._get_plan_or_404(plan_id)
        self._check_access(plan, user)
        cs = self._get_session_or_404(session_id, plan_id)
        return self._hydrate(cs)

    def delete(
        self, plan_id: str, session_id: str, user: User, request: Request
    ) -> None:
        plan = self._get_plan_or_404(plan_id)
        self._check_access(plan, user)
        cs = self._get_session_or_404(session_id, plan_id)
        audit(
            self.db, "clinical_session.delete",
            user_id=user.id, resource_type="clinical_session", resource_id=session_id,
            details={"plan_id": plan_id, "session_number": cs.session_number},
            request=request,
        )
        self.db.delete(cs)
        self.db.commit()

    # ── private helpers ────────────────────────────────────────────────────

    def _get_plan_or_404(self, plan_id: str) -> ExecutionPlan:
        plan = self.db.query(ExecutionPlan).filter(ExecutionPlan.id == plan_id).first()
        if not plan:
            raise HTTPException(404, "Plan de evaluación no encontrado")
        return plan

    def _get_session_or_404(self, session_id: str, plan_id: str) -> ClinicalSession:
        cs = self.db.query(ClinicalSession).filter(
            ClinicalSession.id == session_id,
            ClinicalSession.execution_plan_id == plan_id,
        ).first()
        if not cs:
            raise HTTPException(404, "Sesión clínica no encontrada")
        return cs

    def _check_access(self, plan: ExecutionPlan, user: User) -> None:
        patient = self.db.query(Patient).filter(Patient.id == plan.patient_id).first()
        if not patient or not can_access_patient(self.db, patient, user):
            raise HTTPException(403, "No tienes acceso a este paciente")

    def _hydrate(self, cs: ClinicalSession) -> ClinicalSessionOut:
        test_sessions = (
            self.db.query(TestSession)
            .filter(TestSession.clinical_session_id == cs.id)
            .all()
        )
        return ClinicalSessionOut(
            id=cs.id,
            execution_plan_id=cs.execution_plan_id,
            session_number=cs.session_number,
            session_date=cs.session_date,
            notes=cs.notes,
            created_at=cs.created_at,
            test_count=len(test_sessions),
            test_types=[t.test_type for t in test_sessions],
        )
