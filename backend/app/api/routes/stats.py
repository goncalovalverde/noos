from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from app.db.base import get_db
from app.models.patient import Patient
from app.models.test_session import TestSession
from app.models.protocol import Protocol
from app.models.execution_plan import ExecutionPlan
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.api.utils.access import get_accessible_patient_ids
import json

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview")
async def get_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    if current_user.role == "Administrador":
        patient_q = db.query(func.count(Patient.id))
        tests_q = db.query(func.count(TestSession.id)).filter(TestSession.date >= week_ago)
        completed_q = db.query(func.count(ExecutionPlan.id)).filter(
            ExecutionPlan.status == "completed",
            ExecutionPlan.updated_at >= month_ago,
        )
    else:
        accessible = get_accessible_patient_ids(db, current_user)
        patient_q = db.query(func.count(Patient.id)).filter(Patient.id.in_(accessible))
        tests_q = db.query(func.count(TestSession.id)).filter(
            TestSession.patient_id.in_(accessible),
            TestSession.date >= week_ago,
        )
        completed_q = db.query(func.count(ExecutionPlan.id)).filter(
            ExecutionPlan.patient_id.in_(accessible),
            ExecutionPlan.status == "completed",
            ExecutionPlan.updated_at >= month_ago,
        )

    return {
        "total_patients": patient_q.scalar(),
        "tests_this_week": tests_q.scalar(),
        "active_protocols": db.query(func.count(Protocol.id)).scalar(),
        "completed_this_month": completed_q.scalar(),
    }


@router.get("/recent-plans")
async def get_recent_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Returns last 10 execution plans the user can access."""
    q = db.query(ExecutionPlan)
    if current_user.role != "Administrador":
        accessible = get_accessible_patient_ids(db, current_user)
        q = q.filter(ExecutionPlan.patient_id.in_(accessible))
    plans = q.order_by(ExecutionPlan.updated_at.desc()).limit(10).all()

    result = []
    for plan in plans:
        patient = plan.patient
        protocol = plan.protocol
        result.append({
            "id": plan.id,
            "patient_display_id": patient.get_display_id() if patient else "—",
            "patient_id": plan.patient_id,
            "protocol_name": protocol.name if protocol else "Sin protocolo",
            "status": plan.status,
            "mode": plan.mode,
            "updated_at": plan.updated_at.isoformat() if plan.updated_at else None,
        })
    return result


@router.get("/incomplete-plans")
async def get_incomplete_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Returns active/draft execution plans the user can access."""
    q = db.query(ExecutionPlan).filter(ExecutionPlan.status.in_(["active", "draft"]))
    if current_user.role != "Administrador":
        accessible = get_accessible_patient_ids(db, current_user)
        q = q.filter(ExecutionPlan.patient_id.in_(accessible))
    plans = q.order_by(ExecutionPlan.updated_at.desc()).all()

    result = []
    for plan in plans:
        patient = plan.patient
        protocol = plan.protocol
        result.append({
            "id": plan.id,
            "patient_id": plan.patient_id,
            "patient_display_id": patient.get_display_id() if patient else "—",
            "protocol_name": protocol.name if protocol else "Sin protocolo",
            "updated_at": plan.updated_at.isoformat() if plan.updated_at else None,
        })
    unique_patients = len({p["patient_id"] for p in result})
    return {"count": unique_patients, "plans": result}


@router.get("/classification-distribution")
async def get_classification_distribution(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Returns classification distribution scoped to patients the user can access."""
    q = db.query(TestSession.calculated_scores)
    if current_user.role != "Administrador":
        accessible = get_accessible_patient_ids(db, current_user)
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
