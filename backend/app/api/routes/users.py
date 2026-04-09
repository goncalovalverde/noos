from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.base import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserOut, ProfileUpdate, AdminPasswordReset
from app.auth.dependencies import require_role, get_current_active_user
from app.enums import UserRole
from app.services.user_service import UserService
from app.core.limiter import limiter

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def get_my_profile(
    current_user: User = Depends(get_current_active_user),
):
    return current_user


@router.patch("/me", response_model=UserOut)
@limiter.limit("5/minute")
async def update_my_profile(
    body: ProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return UserService(db).update_profile(body, current_user, request)


@router.get("/", response_model=List[UserOut])
async def list_users(
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.ADMIN)),
):
    return UserService(db).list_users()


@router.post("/", response_model=UserOut, status_code=201)
async def create_user(
    body: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    return UserService(db).create_user(body, current_user, request)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    body: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    return UserService(db).update_user(user_id, body, current_user, request)


@router.get("/{user_id}/patients-count")
async def get_user_patients_count(
    user_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_role(UserRole.ADMIN)),
):
    count = UserService(db).count_owned_patients(user_id)
    return {"count": count}


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    reassign_to: Optional[str] = Query(None, description="User ID to reassign owned patients to"),
):
    UserService(db).delete_user(user_id, current_user, request, reassign_to=reassign_to)


@router.post("/{user_id}/set-password", status_code=204)
async def set_user_password(
    user_id: str,
    body: AdminPasswordReset,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    UserService(db).reset_user_password(user_id, body.new_password, current_user, request)
