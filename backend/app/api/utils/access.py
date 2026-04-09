from sqlalchemy.orm import Session
from app.models.patient import Patient
from app.models.patient_access import PatientAccess
from app.models.user import User
from app.enums import UserRole


def can_access_patient(db: Session, patient: Patient, current_user: User) -> bool:
    """Return True if current_user is allowed to read/write this patient's data."""
    if current_user.role == UserRole.ADMIN:
        return True
    if patient.created_by_id is None:  # legacy patient — open access
        return True
    if patient.created_by_id == current_user.id:
        return True
    grant = db.query(PatientAccess).filter(
        PatientAccess.patient_id == patient.id,
        PatientAccess.user_id == current_user.id,
    ).first()
    return grant is not None


def get_accessible_patient_ids(db: Session, current_user: User):
    """Return a subquery of patient IDs accessible to current_user (non-admin)."""
    from sqlalchemy import or_
    owned = db.query(Patient.id).filter(Patient.created_by_id == current_user.id)
    granted = db.query(PatientAccess.patient_id).filter(PatientAccess.user_id == current_user.id)
    legacy = db.query(Patient.id).filter(Patient.created_by_id.is_(None))
    return owned.union(granted).union(legacy)
