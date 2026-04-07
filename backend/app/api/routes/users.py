from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.base import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.auth.password import hash_password, validate_password_strength
from app.auth.dependencies import require_role

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/", response_model=List[UserOut])
async def list_users(
    db: Session = Depends(get_db),
    _=Depends(require_role("Administrador")),
):
    return db.query(User).order_by(User.created_at).all()

@router.post("/", response_model=UserOut, status_code=201)
async def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("Administrador")),
):
    if not validate_password_strength(body.password):
        raise HTTPException(status_code=400, detail="La contraseña no cumple los requisitos de seguridad")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="El nombre de usuario ya existe")
    user = User(
        username=body.username,
        hashed_password=hash_password(body.password),
        email=body.email,
        full_name=body.full_name,
        role=body.role,
        can_manage_protocols=body.can_manage_protocols,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    body: UserUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_role("Administrador")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_role("Administrador")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    db.delete(user)
    db.commit()
