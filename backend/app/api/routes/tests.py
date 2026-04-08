from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
import json
from app.db.base import get_db
from app.models.test_session import TestSession
from app.models.execution_plan import ExecutionPlan
from app.schemas.test_session import TestSessionCreate, TestSessionUpdate, TestSessionOut
from app.auth.dependencies import get_current_active_user, require_role
from app.models.user import User
from app.models.patient import Patient
from app.services.normatives.calculator import calculator
from app.services.normatives.raw_score_extractor import extract_raw_score
from app.api.utils.access import can_access_patient
from app.api.utils.audit import audit

router = APIRouter(prefix="/api/tests", tags=["tests"])

def _auto_complete_plan(plan_id: str, db: Session) -> None:
    """Mark execution plan as completed if all non-skipped tests have been saved."""
    plan = db.query(ExecutionPlan).filter(ExecutionPlan.id == plan_id).first()
    if not plan or plan.status != 'active':
        return
    required = {t['test_type'] for t in plan.get_tests_to_execute()}
    if not required:
        return
    done = {
        s.test_type
        for s in db.query(TestSession).filter(TestSession.execution_plan_id == plan_id).all()
    }
    if required.issubset(done):
        plan.status = 'completed'
        db.commit()

@router.post("/", response_model=TestSessionOut, status_code=201)
async def create_test(
    body: TestSessionCreate,
    request: Request,
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
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")
    if not can_access_patient(db, patient, current_user):
        raise HTTPException(403, "No tienes acceso a este paciente")
    if patient:
        try:
            if body.raw_data.get("puntuacion_escalar_wais"):
                scores = calculator.calculate_from_pe(body.test_type, int(body.raw_data["puntuacion_escalar_wais"]))
            else:
                raw_score = extract_raw_score(body.test_type, body.raw_data)
                scores = calculator.calculate(body.test_type, raw_score, patient.age, patient.education_years)
            session.set_calculated_scores(scores)
        except Exception:
            pass

    db.add(session)
    db.flush()
    audit(db, "test.create", user_id=current_user.id, resource_type="test_session", resource_id=session.id,
          details={"test_type": body.test_type, "patient_id": body.patient_id,
                   "execution_plan_id": body.execution_plan_id}, request=request)
    db.commit()
    db.refresh(session)

    # Auto-complete plan if all tests are now done
    if body.execution_plan_id:
        _auto_complete_plan(body.execution_plan_id, db)

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
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")
    if not can_access_patient(db, patient, current_user):
        raise HTTPException(403, "No tienes acceso a este paciente")
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
    patient = db.query(Patient).filter(Patient.id == session.patient_id).first()
    if patient and not can_access_patient(db, patient, current_user):
        raise HTTPException(403, "No tienes acceso a este paciente")
    out = TestSessionOut.model_validate(session)
    out.raw_data = session.get_raw_data()
    out.calculated_scores = session.get_calculated_scores()
    out.qualitative_data = session.get_qualitative_data()
    return out

@router.patch("/{test_id}", response_model=TestSessionOut)
async def update_test(
    test_id: str,
    body: TestSessionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Administrador", "Neuropsicólogo")),
):
    session = db.query(TestSession).filter(TestSession.id == test_id).first()
    if not session:
        raise HTTPException(404, "Test no encontrado")
    patient = db.query(Patient).filter(Patient.id == session.patient_id).first()
    if patient and not can_access_patient(db, patient, current_user):
        raise HTTPException(403, "No tienes acceso a este paciente")
    session.set_raw_data(body.raw_data)
    if body.qualitative_data is not None:
        session.set_qualitative_data(body.qualitative_data)

    patient = db.query(Patient).filter(Patient.id == session.patient_id).first()
    if patient:
        try:
            if body.raw_data.get("puntuacion_escalar_wais"):
                scores = calculator.calculate_from_pe(session.test_type, int(body.raw_data["puntuacion_escalar_wais"]))
            else:
                raw_score = extract_raw_score(session.test_type, body.raw_data)
                scores = calculator.calculate(session.test_type, raw_score, patient.age, patient.education_years)
            session.set_calculated_scores(scores)
        except Exception:
            pass

    audit(db, "test.update", user_id=current_user.id, resource_type="test_session", resource_id=test_id,
          details={"fields_changed": sorted(body.raw_data.keys()), "test_type": session.test_type},
          request=request)
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
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Administrador")),
):
    session = db.query(TestSession).filter(TestSession.id == test_id).first()
    if not session:
        raise HTTPException(404, "Test no encontrado")
    patient = db.query(Patient).filter(Patient.id == session.patient_id).first()
    if patient and not can_access_patient(db, patient, current_user):
        raise HTTPException(403, "No tienes acceso a este paciente")
    audit(db, "test.delete", user_id=current_user.id, resource_type="test_session", resource_id=test_id,
          details={"test_type": session.test_type, "patient_id": session.patient_id}, request=request)
    db.delete(session)
    db.commit()
