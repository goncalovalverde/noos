from fastapi import HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from app.models.user import User
from app.models.patient import Patient
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

    def count_owned_patients(self, user_id: str) -> int:
        self._get_or_404(user_id)
        return self.db.query(Patient).filter(Patient.created_by_id == user_id).count()

    def delete_user(self, user_id: str, actor: User, request: Request,
                    reassign_to: Optional[str] = None) -> None:
        if user_id == actor.id:
            raise HTTPException(400, "No puedes eliminar tu propia cuenta")
        user = self._get_or_404(user_id)

        owned = self.db.query(Patient).filter(Patient.created_by_id == user_id).all()
        if owned:
            if reassign_to:
                new_owner = self.db.query(User).filter(User.id == reassign_to).first()
                if not new_owner:
                    raise HTTPException(404, "El usuario de reasignación no existe")
                if new_owner.id == user_id:
                    raise HTTPException(400, "No puedes reasignar al mismo usuario que se elimina")
            else:
                # Fallback: assign to admin user
                new_owner = self.db.query(User).filter(User.username == "admin").first()

            new_owner_id = new_owner.id if new_owner else None
            for patient in owned:
                patient.created_by_id = new_owner_id
            self.db.flush()

        audit(self.db, "user.delete", user_id=actor.id, resource_type="user", resource_id=user_id,
              details={
                  "username": user.username,
                  "role": user.role,
                  "patients_reassigned": len(owned),
                  "reassigned_to": reassign_to or ("admin" if owned else None),
              }, request=request)
        self.db.delete(user)
        self.db.commit()

    def reset_user_password(self, user_id: str, new_password: str, actor: User, request: Request) -> None:
        """Admin sets a new password for any user without requiring the current one."""
        user = self._get_or_404(user_id)
        if not validate_password_strength(new_password):
            raise HTTPException(400, "La contraseña no cumple los requisitos de seguridad "
                                "(mín. 12 caracteres, mayúsculas, minúsculas, números y símbolo especial)")
        user.hashed_password = hash_password(new_password)
        audit(self.db, "user.password_reset_by_admin", user_id=actor.id, resource_type="user",
              resource_id=user_id, details={"target_username": user.username}, request=request)
        self.db.commit()

    def update_profile(self, body, user: User, request: Request) -> UserOut:
        """Update the authenticated user's own email and/or password."""
        db_user = self.db.query(User).filter(User.id == user.id).first()
        changed_fields = []

        if body.email is not None:
            existing = self.db.query(User).filter(User.email == body.email, User.id != db_user.id).first()
            if existing:
                raise HTTPException(409, "Ese email ya está en uso")
            db_user.email = body.email
            changed_fields.append("email")

        if body.new_password:
            if not body.current_password:
                raise HTTPException(400, "Debes indicar la contraseña actual para cambiarla")
            if not verify_password(body.current_password, db_user.hashed_password):
                raise HTTPException(400, "Contraseña actual incorrecta")
            if not validate_password_strength(body.new_password):
                raise HTTPException(400, "La nueva contraseña no cumple los requisitos de seguridad "
                                    "(mín. 12 caracteres, mayúsculas, minúsculas, números y símbolo especial)")
            db_user.hashed_password = hash_password(body.new_password)
            changed_fields.append("password")

        if changed_fields:
            audit(self.db, "user.profile_update", user_id=user.id, resource_type="user",
                  resource_id=user.id, details={"fields": changed_fields}, request=request)

        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    # ── private helpers ────────────────────────────────────────────────────

    def _get_or_404(self, user_id: str) -> User:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(404, "Usuario no encontrado")
        return user
