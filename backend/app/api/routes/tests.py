from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.schemas.test_session import TestSessionCreate, TestSessionUpdate, TestSessionOut
from app.auth.dependencies import get_current_active_user, require_role
from app.enums import UserRole
from app.services.test_service import TestService

router = APIRouter(prefix="/api/tests", tags=["tests"])


@router.post("/", response_model=TestSessionOut, status_code=201)
async def create_test(
    body: TestSessionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.NEURO)),
):
    return TestService(db).create_test(body, current_user, request)


@router.get("/patient/{patient_id}")
async def get_tests_by_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return TestService(db).get_tests_by_patient(patient_id, current_user)


@router.get("/{test_id}", response_model=TestSessionOut)
async def get_test(
    test_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return TestService(db).get_test(test_id, current_user)


@router.patch("/{test_id}", response_model=TestSessionOut)
async def update_test(
    test_id: str,
    body: TestSessionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.NEURO)),
):
    return TestService(db).update_test(test_id, body, current_user, request)


@router.delete("/{test_id}", status_code=204)
async def delete_test(
    test_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    TestService(db).delete_test(test_id, current_user, request)
