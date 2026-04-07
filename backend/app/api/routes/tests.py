from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json
from app.db.base import get_db
from app.models.test_session import TestSession
from app.models.audit_log import AuditLog
from app.schemas.test_session import TestSessionCreate, TestSessionUpdate, TestSessionOut
from app.auth.dependencies import get_current_active_user, require_role
from app.models.user import User
from app.models.patient import Patient
from app.services.normatives.calculator import calculator
from app.services.normatives.raw_score_extractor import extract_raw_score

router = APIRouter(prefix="/api/tests", tags=["tests"])

@router.post("/", response_model=TestSessionOut, status_code=201)
async def create_test(
    body: TestSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Administrador", "Neuropsicólogo")),
):
    session = TestSession(
        patient_id=body.patient_id,
        test_type=body.test_type,
        protocol_id=body.protocol_id,
        execution_plan_id=body.execution_plan_id,
    )
    session.set_raw_data(body.raw_data)
    if body.qualitative_data:
        session.set_qualitative_data(body.qualitative_data)

    patient = db.query(Patient).filter(Patient.id == body.patient_id).first()
    if patient:
        try:
            raw_score = extract_raw_score(body.test_type, body.raw_data)
            scores = calculator.calculate(body.test_type, raw_score, patient.age, patient.education_years)
            session.set_calculated_scores(scores)
        except Exception:
            pass

    db.add(session)
    db.commit()
    db.refresh(session)
    out = TestSessionOut.model_validate(session)
    out.raw_data = session.get_raw_data()
    out.calculated_scores = session.get_calculated_scores()
    out.qualitative_data = session.get_qualitative_data()
    return out

@router.get("/patient/{patient_id}")
async def get_tests_by_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    sessions = db.query(TestSession).filter(
        TestSession.patient_id == patient_id
    ).order_by(TestSession.date.desc()).all()
    return [
        {**TestSessionOut.model_validate(s).model_dump(),
         "raw_data": s.get_raw_data(),
         "calculated_scores": s.get_calculated_scores(),
         "qualitative_data": s.get_qualitative_data()}
        for s in sessions
    ]

@router.get("/{test_id}", response_model=TestSessionOut)
async def get_test(
    test_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    session = db.query(TestSession).filter(TestSession.id == test_id).first()
    if not session:
        raise HTTPException(404, "Test no encontrado")
    out = TestSessionOut.model_validate(session)
    out.raw_data = session.get_raw_data()
    out.calculated_scores = session.get_calculated_scores()
    out.qualitative_data = session.get_qualitative_data()
    return out

@router.patch("/{test_id}", response_model=TestSessionOut)
async def update_test(
    test_id: str,
    body: TestSessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Administrador", "Neuropsicólogo")),
):
    session = db.query(TestSession).filter(TestSession.id == test_id).first()
    if not session:
        raise HTTPException(404, "Test no encontrado")
    old_raw = session.get_raw_data()
    session.set_raw_data(body.raw_data)
    if body.qualitative_data is not None:
        session.set_qualitative_data(body.qualitative_data)

    patient = db.query(Patient).filter(Patient.id == session.patient_id).first()
    if patient:
        try:
            raw_score = extract_raw_score(session.test_type, body.raw_data)
            scores = calculator.calculate(session.test_type, raw_score, patient.age, patient.education_years)
            session.set_calculated_scores(scores)
        except Exception:
            pass

    db.add(AuditLog(
        user_id=current_user.id,
        action="test.update",
        resource_type="test_session",
        resource_id=test_id,
        details=json.dumps({"before": old_raw, "after": body.raw_data}),
    ))
    db.commit()
    db.refresh(session)
    out = TestSessionOut.model_validate(session)
    out.raw_data = session.get_raw_data()
    out.calculated_scores = session.get_calculated_scores()
    out.qualitative_data = session.get_qualitative_data()
    return out

@router.delete("/{test_id}", status_code=204)
async def delete_test(
    test_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Administrador")),
):
    session = db.query(TestSession).filter(TestSession.id == test_id).first()
    if not session:
        raise HTTPException(404, "Test no encontrado")
    db.delete(session)
    db.commit()
