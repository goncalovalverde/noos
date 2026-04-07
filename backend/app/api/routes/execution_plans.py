from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.base import get_db
from app.models.execution_plan import ExecutionPlan
from app.models.protocol import Protocol
from app.schemas.execution_plan import ExecutionPlanCreate, ExecutionPlanUpdate, ExecutionPlanOut
from app.auth.dependencies import get_current_active_user, require_role
from app.models.user import User
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
    customizations = [
        {"test_type": t.test_type, "order": t.order, "skip": False, "added": False, "repeat_later": False, "notes": t.default_notes or ""}
        for t in sorted(protocol.tests, key=lambda x: x.order)
    ]
    plan = ExecutionPlan(
        patient_id=body.patient_id,
        protocol_id=body.protocol_id,
        mode=body.mode,
        test_customizations=json.dumps(customizations),
        status="draft",
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    out = ExecutionPlanOut.model_validate(plan)
    out.test_customizations = plan._get_customizations()
    return out

@router.get("/patient/{patient_id}", response_model=List[ExecutionPlanOut])
async def get_plans_for_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    plans = db.query(ExecutionPlan).filter(
        ExecutionPlan.patient_id == patient_id
    ).order_by(ExecutionPlan.created_at.desc()).all()
    result = []
    for plan in plans:
        out = ExecutionPlanOut.model_validate(plan)
        out.test_customizations = plan._get_customizations()
        result.append(out)
    return result

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
    db.commit()
    db.refresh(plan)
    out = ExecutionPlanOut.model_validate(plan)
    out.test_customizations = plan._get_customizations()
    return out
