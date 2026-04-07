from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.models.patient import Patient
from app.models.test_session import TestSession
from app.models.execution_plan import ExecutionPlan
from app.models.protocol import Protocol
from app.auth.dependencies import get_current_active_user
from app.services.reports.pdf_generator import generate_pdf_report
from app.services.reports.word_generator import generate_word_report

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _build_report_data(plan_id: str, db: Session):
    plan = db.query(ExecutionPlan).filter(ExecutionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan no encontrado")
    patient = db.query(Patient).filter(Patient.id == plan.patient_id).first()
    if not patient:
        raise HTTPException(404, "Paciente no encontrado")
    sessions = db.query(TestSession).filter(
        TestSession.execution_plan_id == plan_id
    ).order_by(TestSession.date).all()
    protocol_name = None
    if plan.protocol_id:
        p = db.query(Protocol).filter(Protocol.id == plan.protocol_id).first()
        if p:
            protocol_name = p.name
    patient_dict = {
        'id': patient.id,
        'display_id': patient.get_display_id(),
        'age': patient.age,
        'education_years': patient.education_years,
        'laterality': patient.laterality,
    }
    sessions_list = [{
        'test_type': s.test_type,
        'date': s.date.isoformat() if s.date else None,
        'calculated_scores': s.get_calculated_scores(),
        'raw_data': s.get_raw_data(),
        'qualitative_data': s.get_qualitative_data(),
    } for s in sessions]
    plan_dict = {'id': plan.id, 'status': plan.status, 'mode': plan.mode}
    return patient_dict, sessions_list, plan_dict, protocol_name


@router.get("/{plan_id}/pdf")
async def download_pdf(
    plan_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    patient_dict, sessions_list, plan_dict, protocol_name = _build_report_data(plan_id, db)
    pdf_bytes = generate_pdf_report(patient_dict, sessions_list, plan_dict, protocol_name)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=informe_{plan_id[:8]}.pdf"},
    )


@router.get("/{plan_id}/word")
async def download_word(
    plan_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    patient_dict, sessions_list, plan_dict, protocol_name = _build_report_data(plan_id, db)
    word_bytes = generate_word_report(patient_dict, sessions_list, plan_dict, protocol_name)
    return Response(
        content=word_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename=informe_{plan_id[:8]}.docx"},
    )
