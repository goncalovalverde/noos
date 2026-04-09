from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.base import get_db
from app.models.user import User
from app.schemas.protocol import ProtocolCreate, ProtocolUpdate, ProtocolOut
from app.auth.dependencies import get_current_active_user, require_protocol_management
from app.services.protocol_service import ProtocolService

router = APIRouter(prefix="/api/protocols", tags=["protocols"])


@router.get("/", response_model=List[ProtocolOut])
async def list_protocols(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return ProtocolService(db).list_protocols(current_user, category)


@router.post("/", response_model=ProtocolOut, status_code=201)
async def create_protocol(
    body: ProtocolCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_protocol_management()),
):
    return ProtocolService(db).create_protocol(body, current_user, request)


@router.get("/{protocol_id}", response_model=ProtocolOut)
async def get_protocol(
    protocol_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return ProtocolService(db).get_protocol(protocol_id)


@router.put("/{protocol_id}", response_model=ProtocolOut)
async def update_protocol(
    protocol_id: str,
    body: ProtocolUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_protocol_management()),
):
    return ProtocolService(db).update_protocol(protocol_id, body, current_user, request)


@router.delete("/{protocol_id}", status_code=204)
async def delete_protocol(
    protocol_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_protocol_management()),
):
    ProtocolService(db).delete_protocol(protocol_id, current_user, request)
