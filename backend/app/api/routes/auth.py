import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserOut, ChangePasswordRequest, RefreshRequest
from app.auth.password import verify_password, hash_password, validate_password_strength
from app.auth.jwt import create_access_token, create_refresh_token, decode_refresh_token
from app.auth.dependencies import get_current_active_user
from app.core.config import settings
from app.core.limiter import limiter
from app.api.utils.audit import audit

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username, User.is_active == True).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña incorrectos")

    user.last_login = datetime.utcnow()
    audit(db, "auth.login", user_id=user.id, request=request)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        {"sub": user.id, "role": user.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh = create_refresh_token({"sub": user.id, "role": user.role})
    return TokenResponse(access_token=token, refresh_token=refresh, user=UserOut.model_validate(user))

@router.post("/logout")
async def logout(request: Request, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    audit(db, "auth.logout", user_id=current_user.id, request=request)
    db.commit()
    return {"message": "Sesión cerrada"}

@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
async def refresh_token(body: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    payload = decode_refresh_token(body.refresh_token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido o expirado")

    user = db.query(User).filter(User.id == payload["sub"], User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado o inactivo")

    new_access = create_access_token({"sub": user.id, "role": user.role})
    new_refresh = create_refresh_token({"sub": user.id, "role": user.role})
    return TokenResponse(access_token=new_access, refresh_token=new_refresh, user=UserOut.model_validate(user))

@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_active_user)):
    return UserOut.model_validate(current_user)

@router.post("/change-password")
@limiter.limit("5/minute")
async def change_password(
    body: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    if not validate_password_strength(body.new_password):
        raise HTTPException(status_code=400, detail="La nueva contraseña no cumple los requisitos de seguridad (mín. 12 caracteres, mayúsculas, minúsculas, números y símbolo)")
    current_user.hashed_password = hash_password(body.new_password)
    audit(db, "auth.password_change", user_id=current_user.id, request=request)
    db.commit()
    return {"message": "Contraseña actualizada"}
