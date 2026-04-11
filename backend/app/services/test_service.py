from fastapi import HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
import logging

from app.models.test_session import TestSession
from app.models.execution_plan import ExecutionPlan
from app.models.patient import Patient
from app.models.user import User
from app.schemas.test_session import TestSessionCreate, TestSessionUpdate, TestSessionOut
from app.services.normatives.calculator import calculator
from app.services.normatives.raw_score_extractor import extract_raw_score
from app.api.utils.access import can_access_patient
from app.api.utils.audit import audit

_log = logging.getLogger(__name__)

class TestService:
    def __init__(self, db: Session):
        self.db = db

    def create_test(self, body: TestSessionCreate, user: User, request: Request) -> TestSessionOut:
        patient = self.db.query(Patient).filter(Patient.id == body.patient_id).first()
        if not patient:
            raise HTTPException(404, "Paciente no encontrado")
        if not can_access_patient(self.db, patient, user):
            raise HTTPException(403, "No tienes acceso a este paciente")

        session = TestSession(
            patient_id=body.patient_id,
            test_type=body.test_type,
            protocol_id=body.protocol_id,
            execution_plan_id=body.execution_plan_id,
            clinical_session_id=body.clinical_session_id,
        )
        session.set_raw_data(body.raw_data)
        if body.qualitative_data:
            session.set_qualitative_data(body.qualitative_data)
        session.set_calculated_scores(self._calculate_scores(body.test_type, body.raw_data, patient))

        self.db.add(session)
        self.db.flush()
        audit(self.db, "test.create", user_id=user.id, resource_type="test_session",
              resource_id=session.id,
              details={"test_type": body.test_type, "patient_id": body.patient_id,
                       "execution_plan_id": body.execution_plan_id},
              request=request)
        self.db.commit()
        self.db.refresh(session)

        if body.execution_plan_id:
            self._auto_complete_plan(body.execution_plan_id)

        return self._hydrate(session)

    def get_test(self, test_id: str, user: User) -> TestSessionOut:
        session = self._get_or_404(test_id)
        patient = self.db.query(Patient).filter(Patient.id == session.patient_id).first()
        if patient and not can_access_patient(self.db, patient, user):
            raise HTTPException(403, "No tienes acceso a este paciente")
        return self._hydrate(session)

    def get_tests_by_patient(self, patient_id: str, user: User) -> list:
        patient = self.db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(404, "Paciente no encontrado")
        if not can_access_patient(self.db, patient, user):
            raise HTTPException(403, "No tienes acceso a este paciente")
        sessions = self.db.query(TestSession).filter(
            TestSession.patient_id == patient_id
        ).order_by(TestSession.date.desc()).all()
        return [
            {**TestSessionOut.model_validate(s).model_dump(),
             "raw_data": s.get_raw_data(),
             "calculated_scores": s.get_calculated_scores(),
             "qualitative_data": s.get_qualitative_data()}
            for s in sessions
        ]

    def update_test(self, test_id: str, body: TestSessionUpdate, user: User, request: Request) -> TestSessionOut:
        session = self._get_or_404(test_id)
        patient = self.db.query(Patient).filter(Patient.id == session.patient_id).first()
        if patient and not can_access_patient(self.db, patient, user):
            raise HTTPException(403, "No tienes acceso a este paciente")

        session.set_raw_data(body.raw_data)
        if body.qualitative_data is not None:
            session.set_qualitative_data(body.qualitative_data)
        if patient:
            session.set_calculated_scores(self._calculate_scores(session.test_type, body.raw_data, patient))

        audit(self.db, "test.update", user_id=user.id, resource_type="test_session",
              resource_id=test_id,
              details={"fields_changed": sorted(body.raw_data.keys()), "test_type": session.test_type},
              request=request)
        self.db.commit()
        self.db.refresh(session)
        return self._hydrate(session)

    def delete_test(self, test_id: str, user: User, request: Request) -> None:
        session = self._get_or_404(test_id)
        patient = self.db.query(Patient).filter(Patient.id == session.patient_id).first()
        if patient and not can_access_patient(self.db, patient, user):
            raise HTTPException(403, "No tienes acceso a este paciente")
        audit(self.db, "test.delete", user_id=user.id, resource_type="test_session",
              resource_id=test_id,
              details={"test_type": session.test_type, "patient_id": session.patient_id},
              request=request)
        self.db.delete(session)
        self.db.commit()

    # ── private helpers ────────────────────────────────────────────────────

    def _get_or_404(self, test_id: str) -> TestSession:
        session = self.db.query(TestSession).filter(TestSession.id == test_id).first()
        if not session:
            raise HTTPException(404, "Test no encontrado")
        return session

    def _hydrate(self, session: TestSession) -> TestSessionOut:
        """Attach JSON fields that are stored as text onto the output schema."""
        out = TestSessionOut.model_validate(session)
        out.raw_data = session.get_raw_data()
        out.calculated_scores = session.get_calculated_scores()
        out.qualitative_data = session.get_qualitative_data()
        return out

    def _calculate_scores(self, test_type: str, raw_data: dict, patient: Patient) -> dict:
        """Run normative calculation; return empty dict on any error (non-fatal).

        Errors are logged as warnings so they surface during development without
        crashing the test-save flow — a missing normative table is not fatal.
        """
        try:
            if raw_data.get("puntuacion_escalar_wais"):
                return calculator.calculate_from_pe(test_type, int(raw_data["puntuacion_escalar_wais"]))
            raw_score = extract_raw_score(test_type, raw_data)
            return calculator.calculate(test_type, raw_score, patient.age, patient.education_years)
        except Exception as exc:
            _log.warning(
                "Score calculation failed for test_type=%r patient=%s: %s",
                test_type, patient.id, exc,
            )
            return {}

    def _auto_complete_plan(self, plan_id: str) -> None:
        """Mark execution plan as completed if all non-skipped tests have been saved."""
        plan = self.db.query(ExecutionPlan).filter(ExecutionPlan.id == plan_id).first()
        if not plan or plan.status != "active":
            return
        required = {t["test_type"] for t in plan.get_tests_to_execute()}
        if not required:
            return
        done = {
            s.test_type
            for s in self.db.query(TestSession).filter(TestSession.execution_plan_id == plan_id).all()
        }
        if required.issubset(done):
            plan.status = "completed"
            self.db.commit()
