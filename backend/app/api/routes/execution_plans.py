from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from datetime import datetime
from app.db.base import get_db
from app.models.execution_plan import ExecutionPlan
from app.models.protocol import Protocol
from app.models.patient import Patient
from app.models.test_session import TestSession
from app.schemas.execution_plan import ExecutionPlanCreate, ExecutionPlanUpdate, ExecutionPlanOut
from app.auth.dependencies import get_current_active_user, require_role
from app.models.user import User
from app.api.utils.access import can_access_patient, get_accessible_patient_ids
import json

router = APIRouter(prefix="/api/execution-plans", tags=["execution-plans"])

@router.post("/", response_model=ExecutionPlanOut, status_code=201)
async def create_execution_plan(
    body: ExecutionPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Administrador", "Neuropsicólogo")),
):
    protocol = db.query(Protocol).filter(Protocol.id == body.protocol_id).first()
    if not protocol:
        raise HTTPException(404, "Protocolo no encontrado")
    patient = db.query(Patient).filter(Patient.id == body.patient_id).first()
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")
    if not can_access_patient(db, patient, current_user):
        raise HTTPException(403, "No tienes acceso a este paciente")
    customizations = [
        {"test_type": t.test_type, "order": t.order, "skip": False, "added": False, "repeat_later": False, "notes": t.default_notes or ""}
        for t in sorted(protocol.tests, key=lambda x: x.order)
    ]
    now = datetime.utcnow()
    plan = ExecutionPlan(
        patient_id=body.patient_id,
        protocol_id=body.protocol_id,
        mode=body.mode,
        test_customizations=json.dumps(customizations),
        status="draft",
        # live: performed_at == created_at; paper: use provided date or None
        performed_at=body.performed_at if body.mode == "paper" else now,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    out = ExecutionPlanOut.model_validate(plan)
    out.test_customizations = plan._get_customizations()
    out.allow_customization = protocol.allow_customization
    return out

@router.get("/patient/{patient_id}")
async def get_plans_for_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")
    if not can_access_patient(db, patient, current_user):
        raise HTTPException(403, "No tienes acceso a este paciente")
    plans = db.query(ExecutionPlan).filter(
        ExecutionPlan.patient_id == patient_id
    ).order_by(ExecutionPlan.created_at.desc()).all()

    result = []
    for plan in plans:
        protocol = db.query(Protocol).filter(Protocol.id == plan.protocol_id).first() if plan.protocol_id else None
        test_count = db.query(TestSession).filter(TestSession.execution_plan_id == plan.id).count()
        result.append({
            "id": plan.id,
            "patient_id": plan.patient_id,
            "protocol_id": plan.protocol_id,
            "protocol_name": protocol.name if protocol else None,
            "protocol_category": protocol.category if protocol else None,
            "status": plan.status,
            "mode": plan.mode,
            "performed_at": plan.performed_at,
            "created_at": plan.created_at,
            "test_count": test_count,
            "total_tests": len(plan.get_tests_to_execute()),
        })
    return result

@router.get("/incomplete")
async def get_incomplete_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Returns active/draft execution plans the user can access."""
    q = db.query(ExecutionPlan).filter(
        ExecutionPlan.status.in_(["active", "draft"])
    )
    if current_user.role != "Administrador":
        accessible_ids = get_accessible_patient_ids(db, current_user)
        q = q.filter(ExecutionPlan.patient_id.in_(accessible_ids))
    plans = q.order_by(ExecutionPlan.updated_at.desc()).all()

    result = []
    for plan in plans:
        protocol = db.query(Protocol).filter(Protocol.id == plan.protocol_id).first() if plan.protocol_id else None
        test_count = db.query(TestSession).filter(TestSession.execution_plan_id == plan.id).count()
        patient_display_id = plan.patient.get_display_id() if plan.patient else "—"
        result.append({
            "id": plan.id,
            "patient_id": plan.patient_id,
            "patient_display_id": patient_display_id,
            "protocol_id": plan.protocol_id,
            "protocol_name": protocol.name if protocol else None,
            "status": plan.status,
            "mode": plan.mode,
            "performed_at": plan.performed_at,
            "created_at": plan.created_at,
            "test_count": test_count,
            "total_tests": len(plan.get_tests_to_execute()),
        })
    return result


@router.get("/{plan_id}/results")
async def get_plan_results(
    plan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Return execution plan with all its test sessions grouped."""
    plan = db.query(ExecutionPlan).filter(ExecutionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan de evaluación no encontrado")
    patient = db.query(Patient).filter(Patient.id == plan.patient_id).first()
    if patient and not can_access_patient(db, patient, current_user):
        raise HTTPException(403, "No tienes acceso a este paciente")

    protocol = db.query(Protocol).filter(Protocol.id == plan.protocol_id).first() if plan.protocol_id else None

    sessions = db.query(TestSession).filter(
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
                "id": s.id,
                "test_type": s.test_type,
                "date": s.date,
                "raw_data": s.get_raw_data(),
                "calculated_scores": s.get_calculated_scores(),
                "qualitative_data": s.get_qualitative_data(),
            }
            for s in sessions
        ],
    }

@router.get("/{plan_id}", response_model=ExecutionPlanOut)
async def get_execution_plan(
    plan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    plan = db.query(ExecutionPlan).filter(ExecutionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan de evaluación no encontrado")
    out = ExecutionPlanOut.model_validate(plan)
    out.test_customizations = plan._get_customizations()
    if plan.protocol:
        out.allow_customization = plan.protocol.allow_customization
    return out

@router.patch("/{plan_id}", response_model=ExecutionPlanOut)
async def update_execution_plan(
    plan_id: str,
    body: ExecutionPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Administrador", "Neuropsicólogo")),
):
    plan = db.query(ExecutionPlan).filter(ExecutionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan de evaluación no encontrado")
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
    db.commit()
    db.refresh(plan)
    out = ExecutionPlanOut.model_validate(plan)
    out.test_customizations = plan._get_customizations()
    return out
