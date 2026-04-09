from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
import json

from app.models.patient import Patient
from app.models.test_session import TestSession
from app.models.protocol import Protocol
from app.models.execution_plan import ExecutionPlan
from app.models.user import User
from app.api.utils.access import get_accessible_patient_ids
from app.enums import UserRole


class StatsService:
    def __init__(self, db: Session):
        self.db = db

    def get_overview(self, user: User) -> dict:
        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)

        if user.role == UserRole.ADMIN:
            patient_q = self.db.query(func.count(Patient.id))
            tests_q = self.db.query(func.count(TestSession.id)).filter(TestSession.date >= week_ago)
            completed_q = self.db.query(func.count(ExecutionPlan.id)).filter(
                ExecutionPlan.status == "completed",
                ExecutionPlan.updated_at >= month_ago,
            )
        else:
            accessible = get_accessible_patient_ids(self.db, user)
            patient_q = self.db.query(func.count(Patient.id)).filter(Patient.id.in_(accessible))
            tests_q = self.db.query(func.count(TestSession.id)).filter(
                TestSession.patient_id.in_(accessible),
                TestSession.date >= week_ago,
            )
            completed_q = self.db.query(func.count(ExecutionPlan.id)).filter(
                ExecutionPlan.patient_id.in_(accessible),
                ExecutionPlan.status == "completed",
                ExecutionPlan.updated_at >= month_ago,
            )

        return {
            "total_patients": patient_q.scalar(),
            "tests_this_week": tests_q.scalar(),
            "active_protocols": self.db.query(func.count(Protocol.id)).scalar(),
            "completed_this_month": completed_q.scalar(),
        }

    def get_recent_plans(self, user: User) -> list:
        q = self.db.query(ExecutionPlan)
        if user.role != UserRole.ADMIN:
            accessible = get_accessible_patient_ids(self.db, user)
            q = q.filter(ExecutionPlan.patient_id.in_(accessible))
        plans = q.order_by(ExecutionPlan.updated_at.desc()).limit(10).all()
        return [
            {
                "id": plan.id,
                "patient_display_id": plan.patient.get_display_id() if plan.patient else "—",
                "patient_id": plan.patient_id,
                "protocol_name": plan.protocol.name if plan.protocol else "Sin protocolo",
                "status": plan.status,
                "mode": plan.mode,
                "updated_at": plan.updated_at.isoformat() if plan.updated_at else None,
            }
            for plan in plans
        ]

    def get_incomplete_plans(self, user: User) -> dict:
        q = self.db.query(ExecutionPlan).filter(ExecutionPlan.status.in_(["active", "draft"]))
        if user.role != UserRole.ADMIN:
            accessible = get_accessible_patient_ids(self.db, user)
            q = q.filter(ExecutionPlan.patient_id.in_(accessible))
        plans = q.order_by(ExecutionPlan.updated_at.desc()).all()
        result = [
            {
                "id": plan.id,
                "patient_id": plan.patient_id,
                "patient_display_id": plan.patient.get_display_id() if plan.patient else "—",
                "protocol_name": plan.protocol.name if plan.protocol else "Sin protocolo",
                "updated_at": plan.updated_at.isoformat() if plan.updated_at else None,
            }
            for plan in plans
        ]
        unique_patients = len({p["patient_id"] for p in result})
        return {"count": unique_patients, "plans": result}

    def get_classification_distribution(self, user: User) -> list:
        q = self.db.query(TestSession.calculated_scores)
        if user.role != UserRole.ADMIN:
            accessible = get_accessible_patient_ids(self.db, user)
            q = q.filter(TestSession.patient_id.in_(accessible))
        sessions = q.all()

        distribution = {"Superior": 0, "Normal": 0, "Limítrofe": 0, "Deficitario": 0}
        for (scores_raw,) in sessions:
            if not scores_raw:
                continue
            try:
                scores = json.loads(scores_raw) if isinstance(scores_raw, str) else scores_raw
                cls_ = scores.get("clasificacion")
                if cls_ in distribution:
                    distribution[cls_] += 1
            except Exception:
                continue
        return [{"clasificacion": k, "count": v} for k, v in distribution.items()]
