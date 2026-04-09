from fastapi import HTTPException, Request
from sqlalchemy.orm import Session
from typing import List

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.auth.password import hash_password, validate_password_strength, verify_password
from app.api.utils.audit import audit


class UserService:
    def __init__(self, db: Session):
        self.db = db

    def list_users(self) -> List[UserOut]:
        return self.db.query(User).order_by(User.created_at).all()

    def create_user(self, body: UserCreate, actor: User, request: Request) -> UserOut:
        if not validate_password_strength(body.password):
            raise HTTPException(400, "La contraseña no cumple los requisitos de seguridad")
        if self.db.query(User).filter(User.username == body.username).first():
            raise HTTPException(409, "El nombre de usuario ya existe")
        user = User(
            username=body.username,
            hashed_password=hash_password(body.password),
            email=body.email,
            full_name=body.full_name,
            role=body.role,
            can_manage_protocols=body.can_manage_protocols,
        )
        self.db.add(user)
        self.db.flush()
        audit(self.db, "user.create", user_id=actor.id, resource_type="user", resource_id=user.id,
              details={"username": body.username, "role": body.role}, request=request)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_user(self, user_id: str, body: UserUpdate, actor: User, request: Request) -> UserOut:
        user = self._get_or_404(user_id)
        changes = body.model_dump(exclude_unset=True)
        _allowed = {"email", "full_name", "role", "can_manage_protocols", "is_active"}
        for field, value in changes.items():
            if field in _allowed:
                setattr(user, field, value)
        audit(self.db, "user.update", user_id=actor.id, resource_type="user", resource_id=user_id,
              details={"fields": list(changes.keys())}, request=request)
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete_user(self, user_id: str, actor: User, request: Request) -> None:
        user = self._get_or_404(user_id)
        audit(self.db, "user.delete", user_id=actor.id, resource_type="user", resource_id=user_id,
              details={"username": user.username, "role": user.role}, request=request)
        self.db.delete(user)
        self.db.commit()

    def update_profile(self, body, user: User) -> UserOut:
        """Update the authenticated user's own email and/or password."""
        db_user = self.db.query(User).filter(User.id == user.id).first()

        if body.email is not None:
            existing = self.db.query(User).filter(User.email == body.email, User.id != db_user.id).first()
            if existing:
                raise HTTPException(409, "Esse email já está em uso")
            db_user.email = body.email

        if body.new_password:
            if not body.current_password:
                raise HTTPException(400, "É necessário indicar a password atual para a alterar")
            if not verify_password(body.current_password, db_user.hashed_password):
                raise HTTPException(400, "Password atual incorreta")
            if not validate_password_strength(body.new_password):
                raise HTTPException(400, "A nova password não cumpre os requisitos de segurança (mín. 12 caracteres, maiúsculas, minúsculas, números e símbolo especial)")
            db_user.hashed_password = hash_password(body.new_password)

        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    # ── private helpers ────────────────────────────────────────────────────

    def _get_or_404(self, user_id: str) -> User:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(404, "Usuario no encontrado")
        return user
