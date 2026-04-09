from fastapi import HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List, Optional

from app.models.protocol import Protocol, ProtocolTest
from app.models.execution_plan import ExecutionPlan
from app.models.user import User
from app.schemas.protocol import ProtocolCreate, ProtocolUpdate, ProtocolOut
from app.api.utils.audit import audit
from app.enums import UserRole


class ProtocolService:
    def __init__(self, db: Session):
        self.db = db

    def list_protocols(self, user: User, category: Optional[str] = None) -> List[ProtocolOut]:
        q = self.db.query(Protocol)
        if category:
            q = q.filter(Protocol.category == category)
        if user.role != UserRole.ADMIN:
            q = q.filter(or_(Protocol.is_public == True, Protocol.created_by_id == user.id))  # noqa: E712
        protocols = q.order_by(Protocol.name).all()
        result = []
        for p in protocols:
            out = ProtocolOut.model_validate(p)
            out.active_plans_count = self._active_plans_count(p.id)
            result.append(out)
        return result

    def create_protocol(self, body: ProtocolCreate, user: User, request: Request) -> ProtocolOut:
        if self.db.query(Protocol).filter(Protocol.name == body.name).first():
            raise HTTPException(409, "Ya existe un protocolo con ese nombre")
        protocol = Protocol(
            name=body.name,
            description=body.description,
            category=body.category,
            is_public=body.is_public,
            allow_customization=body.allow_customization,
            created_by_id=user.id,
        )
        self.db.add(protocol)
        self.db.flush()
        for t in body.tests:
            self.db.add(ProtocolTest(protocol_id=protocol.id, **t.model_dump()))
        audit(self.db, "protocol.create", user_id=user.id, resource_type="protocol",
              resource_id=protocol.id, details={"name": body.name, "category": body.category},
              request=request)
        self.db.commit()
        self.db.refresh(protocol)
        return protocol

    def get_protocol(self, protocol_id: str) -> ProtocolOut:
        p = self._get_or_404(protocol_id)
        out = ProtocolOut.model_validate(p)
        out.active_plans_count = self._active_plans_count(p.id)
        return out

    def update_protocol(self, protocol_id: str, body: ProtocolUpdate, user: User, request: Request) -> ProtocolOut:
        p = self._get_or_404(protocol_id)
        changes = body.model_dump(exclude_unset=True, exclude={"tests"})
        for field, value in changes.items():
            setattr(p, field, value)
        if body.tests is not None:
            self.db.query(ProtocolTest).filter(ProtocolTest.protocol_id == protocol_id).delete()
            for t in body.tests:
                self.db.add(ProtocolTest(protocol_id=protocol_id, **t.model_dump()))
        audit(self.db, "protocol.update", user_id=user.id, resource_type="protocol",
              resource_id=protocol_id,
              details={"fields": list(changes.keys()), "tests_updated": body.tests is not None},
              request=request)
        self.db.commit()
        self.db.refresh(p)
        return p

    def delete_protocol(self, protocol_id: str, user: User, request: Request) -> None:
        p = self._get_or_404(protocol_id)
        audit(self.db, "protocol.delete", user_id=user.id, resource_type="protocol",
              resource_id=protocol_id, details={"name": p.name}, request=request)
        self.db.delete(p)
        self.db.commit()

    # ── private helpers ────────────────────────────────────────────────────

    def _get_or_404(self, protocol_id: str) -> Protocol:
        p = self.db.query(Protocol).filter(Protocol.id == protocol_id).first()
        if not p:
            raise HTTPException(404, "Protocolo no encontrado")
        return p

    def _active_plans_count(self, protocol_id: str) -> int:
        return self.db.query(ExecutionPlan).filter(
            ExecutionPlan.protocol_id == protocol_id,
            ExecutionPlan.status.in_(["active", "draft"]),
        ).count()
