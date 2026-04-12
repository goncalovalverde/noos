from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.schemas.execution_plan import ExecutionPlanCreate, ExecutionPlanUpdate, ExecutionPlanOut
from app.auth.dependencies import get_current_active_user, require_role
from app.enums import UserRole
from app.services.execution_plan_service import ExecutionPlanService

router = APIRouter(prefix="/api/execution-plans", tags=["execution-plans"])


@router.post("/", response_model=ExecutionPlanOut, status_code=201)
async def create_execution_plan(
    body: ExecutionPlanCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.NEURO)),
):
    return ExecutionPlanService(db).create_plan(body, current_user, request)


@router.get("/patient/{patient_id}")
async def get_plans_for_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return ExecutionPlanService(db).get_plans_for_patient(patient_id, current_user)


@router.get("/incomplete")
async def get_incomplete_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return ExecutionPlanService(db).get_incomplete_plans(current_user)


@router.get("/{plan_id}/results")
async def get_plan_results(
    plan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return ExecutionPlanService(db).get_plan_results(plan_id, current_user)


@router.get("/{plan_id}", response_model=ExecutionPlanOut)
async def get_execution_plan(
    plan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return ExecutionPlanService(db).get_plan(plan_id, current_user)


@router.delete("/{plan_id}", status_code=204)
async def delete_execution_plan(
    plan_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.NEURO)),
):
    ExecutionPlanService(db).delete_plan(plan_id, current_user, request)


@router.patch("/{plan_id}", response_model=ExecutionPlanOut)
async def update_execution_plan(
    plan_id: str,
    body: ExecutionPlanUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.NEURO)),
):
    return ExecutionPlanService(db).update_plan(plan_id, body, current_user, request)
