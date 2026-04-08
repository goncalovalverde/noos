from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.db.base import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.auth.password import hash_password, validate_password_strength, verify_password
from app.auth.dependencies import require_role, get_current_active_user

router = APIRouter(prefix="/api/users", tags=["users"])

class ProfileUpdate(BaseModel):
    email: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

@router.get("/me", response_model=UserOut)
async def get_my_profile(
    current_user: User = Depends(get_current_active_user),
):
    return current_user

@router.patch("/me", response_model=UserOut)
async def update_my_profile(
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    user = db.query(User).filter(User.id == current_user.id).first()

    if body.email is not None:
        existing = db.query(User).filter(User.email == body.email, User.id != user.id).first()
        if existing:
            raise HTTPException(409, "Esse email já está em uso")
        user.email = body.email

    if body.new_password:
        if not body.current_password:
            raise HTTPException(400, "É necessário indicar a password atual para a alterar")
        if not verify_password(body.current_password, user.hashed_password):
            raise HTTPException(400, "Password atual incorreta")
        if not validate_password_strength(body.new_password):
            raise HTTPException(400, "A nova password não cumpre os requisitos de segurança (mín. 12 caracteres, maiúsculas, minúsculas, números e símbolo especial)")
        user.hashed_password = hash_password(body.new_password)

    db.commit()
    db.refresh(user)
    return user

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
