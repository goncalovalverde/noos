from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.base import get_db
from app.models.protocol import Protocol, ProtocolTest
from app.models.execution_plan import ExecutionPlan
from app.schemas.protocol import ProtocolCreate, ProtocolUpdate, ProtocolOut
from app.auth.dependencies import get_current_active_user, require_protocol_management

router = APIRouter(prefix="/api/protocols", tags=["protocols"])

def _active_plans_count(db: Session, protocol_id: str) -> int:
    return db.query(ExecutionPlan).filter(
        ExecutionPlan.protocol_id == protocol_id,
        ExecutionPlan.status.in_(["active", "draft"]),
    ).count()

@router.get("/", response_model=List[ProtocolOut])
async def list_protocols(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    q = db.query(Protocol)
    if category:
        q = q.filter(Protocol.category == category)
    protocols = q.order_by(Protocol.name).all()
    result = []
    for p in protocols:
        out = ProtocolOut.model_validate(p)
        out.active_plans_count = _active_plans_count(db, p.id)
        result.append(out)
    return result

@router.post("/", response_model=ProtocolOut, status_code=201)
async def create_protocol(
    body: ProtocolCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_protocol_management()),
):
    if db.query(Protocol).filter(Protocol.name == body.name).first():
        raise HTTPException(409, "Ya existe un protocolo con ese nombre")
    protocol = Protocol(name=body.name, description=body.description, category=body.category)
    db.add(protocol)
    db.flush()
    for t in body.tests:
        db.add(ProtocolTest(protocol_id=protocol.id, **t.model_dump()))
    db.commit()
    db.refresh(protocol)
    return protocol

@router.get("/{protocol_id}", response_model=ProtocolOut)
async def get_protocol(
    protocol_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    p = db.query(Protocol).filter(Protocol.id == protocol_id).first()
    if not p:
        raise HTTPException(404, "Protocolo no encontrado")
    out = ProtocolOut.model_validate(p)
    out.active_plans_count = _active_plans_count(db, p.id)
    return out

@router.put("/{protocol_id}", response_model=ProtocolOut)
async def update_protocol(
    protocol_id: str,
    body: ProtocolUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_protocol_management()),
):
    p = db.query(Protocol).filter(Protocol.id == protocol_id).first()
    if not p:
        raise HTTPException(404, "Protocolo no encontrado")
    for field, value in body.model_dump(exclude_unset=True, exclude={"tests"}).items():
        setattr(p, field, value)
    if body.tests is not None:
        db.query(ProtocolTest).filter(ProtocolTest.protocol_id == protocol_id).delete()
        for t in body.tests:
            db.add(ProtocolTest(protocol_id=protocol_id, **t.model_dump()))
    db.commit()
    db.refresh(p)
    return p

@router.delete("/{protocol_id}", status_code=204)
async def delete_protocol(
    protocol_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_protocol_management()),
):
    p = db.query(Protocol).filter(Protocol.id == protocol_id).first()
    if not p:
        raise HTTPException(404, "Protocolo no encontrado")
    db.delete(p)
    db.commit()
