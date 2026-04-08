import json
from datetime import datetime, timezone
from typing import Optional
from fastapi import Request
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog


def audit(
    db: Session,
    action: str,
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Append an immutable audit record to the database.

    Call this before db.commit() so the log entry is part of the same
    transaction as the data change — if the commit fails, the log is
    also rolled back, keeping data and audit trail consistent.

    Args:
        db:            Active SQLAlchemy session.
        action:        Dot-namespaced action string, e.g. 'patient.create'.
        user_id:       ID of the acting user (None for unauthenticated events).
        resource_type: Type of the affected resource, e.g. 'patient'.
        resource_id:   Primary key of the affected resource.
        details:       Arbitrary dict of additional context (serialised to JSON).
        request:       FastAPI Request — used to capture the client IP address.
    """
    ip = request.client.host if request and request.client else None
    db.add(AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=json.dumps(details) if details else None,
        ip_address=ip,
        created_at=datetime.now(timezone.utc),
    ))
