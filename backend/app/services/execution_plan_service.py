from fastapi import HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
import json

from app.models.execution_plan import ExecutionPlan
from app.models.protocol import Protocol
from app.models.patient import Patient
from app.models.test_session import TestSession
from app.models.user import User
from app.schemas.execution_plan import ExecutionPlanCreate, ExecutionPlanUpdate, ExecutionPlanOut
from app.api.utils.access import can_access_patient, get_accessible_patient_ids
from app.api.utils.audit import audit
from app.enums import UserRole


class ExecutionPlanService:
    def __init__(self, db: Session):
        self.db = db

    def create_plan(self, body: ExecutionPlanCreate, user: User, request: Request) -> ExecutionPlanOut:
        protocol = self.db.query(Protocol).filter(Protocol.id == body.protocol_id).first()
        if not protocol:
            raise HTTPException(404, "Protocolo no encontrado")
        patient = self.db.query(Patient).filter(Patient.id == body.patient_id).first()
        if not patient:
            raise HTTPException(404, "Paciente no encontrado")
        if not can_access_patient(self.db, patient, user):
            raise HTTPException(403, "No tienes acceso a este paciente")

        customizations = [
            {"test_type": t.test_type, "order": t.order, "skip": False,
             "added": False, "repeat_later": False, "notes": t.default_notes or ""}
            for t in sorted(protocol.tests, key=lambda x: x.order)
        ]
        now = datetime.now(timezone.utc)
        plan = ExecutionPlan(
            patient_id=body.patient_id,
            protocol_id=body.protocol_id,
            mode=body.mode,
            test_customizations=json.dumps(customizations),
            status="draft",
            performed_at=body.performed_at if body.mode == "paper" else now,
        )
        self.db.add(plan)
        self.db.flush()
        audit(self.db, "execution_plan.create", user_id=user.id, resource_type="execution_plan",
              resource_id=plan.id,
              details={"patient_id": body.patient_id, "protocol_id": body.protocol_id, "mode": body.mode},
              request=request)
        self.db.commit()
        self.db.refresh(plan)
        out = ExecutionPlanOut.model_validate(plan)
        out.test_customizations = plan._get_customizations()
        out.allow_customization = protocol.allow_customization
        return out

    def get_plans_for_patient(self, patient_id: str, user: User) -> list:
        patient = self.db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(404, "Paciente no encontrado")
        if not can_access_patient(self.db, patient, user):
            raise HTTPException(403, "No tienes acceso a este paciente")
        plans = self.db.query(ExecutionPlan).filter(
            ExecutionPlan.patient_id == patient_id
        ).order_by(ExecutionPlan.created_at.desc()).all()
        return [self._plan_summary(plan) for plan in plans]

    def get_incomplete_plans(self, user: User) -> list:
        q = self.db.query(ExecutionPlan).filter(ExecutionPlan.status.in_(["active", "draft"]))
        if user.role != UserRole.ADMIN:
            accessible_ids = get_accessible_patient_ids(self.db, user)
            q = q.filter(ExecutionPlan.patient_id.in_(accessible_ids))
        plans = q.order_by(ExecutionPlan.updated_at.desc()).all()
        return [self._incomplete_summary(plan) for plan in plans]

    def get_plan_results(self, plan_id: str, user: User) -> dict:
        plan = self._get_or_404(plan_id)
        patient = self.db.query(Patient).filter(Patient.id == plan.patient_id).first()
        if patient and not can_access_patient(self.db, patient, user):
            raise HTTPException(403, "No tienes acceso a este paciente")
        protocol = self.db.query(Protocol).filter(Protocol.id == plan.protocol_id).first() if plan.protocol_id else None
        sessions = self.db.query(TestSession).filter(
            TestSession.execution_plan_id == plan_id
        ).order_by(TestSession.date).all()
        return {
            "id": plan.id,
            "patient_id": plan.patient_id,
            "protocol_id": plan.protocol_id,
            "protocol_name": protocol.name if protocol else None,
            "status": plan.status,
            "mode": plan.mode,
            "performed_at": plan.performed_at,
            "created_at": plan.created_at,
            "test_results": [
                {
                    "id": s.id, "test_type": s.test_type, "date": s.date,
                    "raw_data": s.get_raw_data(),
                    "calculated_scores": s.get_calculated_scores(),
                    "qualitative_data": s.get_qualitative_data(),
                }
                for s in sessions
            ],
        }

    def get_plan(self, plan_id: str, user: User) -> ExecutionPlanOut:
        plan = self._get_or_404(plan_id)
        out = ExecutionPlanOut.model_validate(plan)
        out.test_customizations = plan._get_customizations()
        if plan.protocol:
            out.allow_customization = plan.protocol.allow_customization
        return out

    def update_plan(self, plan_id: str, body: ExecutionPlanUpdate, user: User, request: Request) -> ExecutionPlanOut:
        plan = self._get_or_404(plan_id)
        patient = self.db.query(Patient).filter(Patient.id == plan.patient_id).first()
        if not patient or not can_access_patient(self.db, patient, user):
            raise HTTPException(403, "No tienes acceso a este paciente")

        old_status = plan.status
        if body.status is not None:
            plan.status = body.status
        if body.mode is not None:
            plan.mode = body.mode
        if body.test_customizations is not None:
            plan._set_customizations(body.test_customizations)
        if body.variant_name is not None:
            plan.variant_name = body.variant_name
        if body.is_saved_variant is not None:
            plan.is_saved_variant = body.is_saved_variant
        if body.performed_at is not None:
            plan.performed_at = body.performed_at
        if body.status is not None and body.status != old_status:
            audit(self.db, "execution_plan.status_change", user_id=user.id,
                  resource_type="execution_plan", resource_id=plan_id,
                  details={"from": old_status, "to": body.status}, request=request)
        self.db.commit()
        self.db.refresh(plan)
        out = ExecutionPlanOut.model_validate(plan)
        out.test_customizations = plan._get_customizations()
        return out

    # ── private helpers ────────────────────────────────────────────────────

    def _get_or_404(self, plan_id: str) -> ExecutionPlan:
        plan = self.db.query(ExecutionPlan).filter(ExecutionPlan.id == plan_id).first()
        if not plan:
            raise HTTPException(404, "Plan de evaluación no encontrado")
        return plan

    def _plan_summary(self, plan: ExecutionPlan) -> dict:
        protocol = self.db.query(Protocol).filter(Protocol.id == plan.protocol_id).first() if plan.protocol_id else None
        test_count = self.db.query(TestSession).filter(TestSession.execution_plan_id == plan.id).count()
        return {
            "id": plan.id, "patient_id": plan.patient_id, "protocol_id": plan.protocol_id,
            "protocol_name": protocol.name if protocol else None,
            "protocol_category": protocol.category if protocol else None,
            "status": plan.status, "mode": plan.mode, "performed_at": plan.performed_at,
            "created_at": plan.created_at, "test_count": test_count,
            "total_tests": len(plan.get_tests_to_execute()),
        }

    def _incomplete_summary(self, plan: ExecutionPlan) -> dict:
        protocol = self.db.query(Protocol).filter(Protocol.id == plan.protocol_id).first() if plan.protocol_id else None
        test_count = self.db.query(TestSession).filter(TestSession.execution_plan_id == plan.id).count()
        patient_display_id = plan.patient.get_display_id() if plan.patient else "—"
        return {
            "id": plan.id, "patient_id": plan.patient_id, "patient_display_id": patient_display_id,
            "protocol_id": plan.protocol_id,
            "protocol_name": protocol.name if protocol else None,
            "status": plan.status, "mode": plan.mode, "performed_at": plan.performed_at,
            "created_at": plan.created_at, "test_count": test_count,
            "total_tests": len(plan.get_tests_to_execute()),
        }
