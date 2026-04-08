from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from app.db.base import get_db
from app.models.patient import Patient
from app.models.test_session import TestSession
from app.models.protocol import Protocol
from app.models.execution_plan import ExecutionPlan
from app.auth.dependencies import get_current_active_user
import json

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview")
async def get_overview(
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    total_patients = db.query(func.count(Patient.id)).scalar()

    tests_this_week = db.query(func.count(TestSession.id)).filter(
        TestSession.date >= week_ago
    ).scalar()

    active_protocols = db.query(func.count(Protocol.id)).scalar()

    completed_this_month = db.query(func.count(ExecutionPlan.id)).filter(
        ExecutionPlan.status == "completed",
        ExecutionPlan.updated_at >= month_ago,
    ).scalar()

    return {
        "total_patients": total_patients,
        "tests_this_week": tests_this_week,
        "active_protocols": active_protocols,
        "completed_this_month": completed_this_month,
    }


@router.get("/recent-plans")
async def get_recent_plans(
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Returns last 10 execution plans with patient display_id and protocol name."""
    plans = db.query(ExecutionPlan).order_by(
        ExecutionPlan.updated_at.desc()
    ).limit(10).all()

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
    _=Depends(get_current_active_user),
):
    """Returns all active/draft execution plans ordered by updated_at desc."""
    plans = db.query(ExecutionPlan).filter(
        ExecutionPlan.status.in_(["active", "draft"])
    ).order_by(ExecutionPlan.updated_at.desc()).all()

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
    return {"count": len(result), "plans": result}


@router.get("/classification-distribution")
async def get_classification_distribution(
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    """Returns count of each classification from calculated_scores of all test sessions."""
    sessions = db.query(TestSession.calculated_scores).all()
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
