"""
Tests for DELETE /api/patients/{patient_id}.

Business rules:
  - Only the creator (created_by_id == user.id) or an Admin can delete.
  - Neuro user who did NOT create the patient is forbidden even if they have access.
  - Observer cannot delete (wrong role — route requires ADMIN or NEURO).
  - Deletion cascades to test sessions, execution plans, patient access grants.
"""
import pytest
import json
from app.models.patient import Patient
from app.models.patient_access import PatientAccess
from app.models.test_session import TestSession
from app.models.execution_plan import ExecutionPlan


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_owned_patient(db, owner_user) -> Patient:
    p = Patient(age=55, education_years=10, laterality="diestro",
                created_by_id=owner_user.id)
    db.add(p)
    db.flush()
    return p


# ---------------------------------------------------------------------------
# Authorization
# ---------------------------------------------------------------------------

class TestDeletePatientAuthorization:
    def test_creator_neuro_can_delete_own_patient(self, client, db, neuro_user, neuro_headers):
        patient = _make_owned_patient(db, neuro_user)
        db.commit()

        r = client.delete(f"/api/patients/{patient.id}", headers=neuro_headers)
        assert r.status_code == 204

    def test_admin_can_delete_any_patient(self, client, db, neuro_user, admin_headers):
        patient = _make_owned_patient(db, neuro_user)
        db.commit()

        r = client.delete(f"/api/patients/{patient.id}", headers=admin_headers)
        assert r.status_code == 204

    def test_neuro_cannot_delete_other_neuro_patient(self, client, db, admin_user, neuro_headers):
        """A Neuro who didn't create the patient gets 403 even with access."""
        patient = _make_owned_patient(db, admin_user)
        db.commit()

        r = client.delete(f"/api/patients/{patient.id}", headers=neuro_headers)
        assert r.status_code == 403

    def test_observer_cannot_delete_any_patient(self, client, db, neuro_user, observer_headers):
        patient = _make_owned_patient(db, neuro_user)
        db.commit()

        r = client.delete(f"/api/patients/{patient.id}", headers=observer_headers)
        assert r.status_code == 403

    def test_unauthenticated_cannot_delete(self, client, db, neuro_user):
        patient = _make_owned_patient(db, neuro_user)
        db.commit()

        r = client.delete(f"/api/patients/{patient.id}")
        assert r.status_code == 401

    def test_neuro_with_access_grant_but_not_creator_gets_403(self, client, db, neuro_user, admin_user, neuro_headers):
        """Having a PatientAccess grant does not confer delete rights."""
        patient = _make_owned_patient(db, admin_user)
        db.add(PatientAccess(patient_id=patient.id, user_id=neuro_user.id, granted_by_id=admin_user.id))
        db.commit()

        r = client.delete(f"/api/patients/{patient.id}", headers=neuro_headers)
        assert r.status_code == 403

    def test_deleting_nonexistent_patient_returns_404(self, client, neuro_headers):
        r = client.delete("/api/patients/does-not-exist", headers=neuro_headers)
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Cascade deletion
# ---------------------------------------------------------------------------

class TestDeletePatientCascade:
    def test_delete_removes_patient_record(self, client, db, neuro_user, neuro_headers):
        patient = _make_owned_patient(db, neuro_user)
        patient_id = patient.id
        db.commit()

        client.delete(f"/api/patients/{patient_id}", headers=neuro_headers)

        assert db.query(Patient).filter(Patient.id == patient_id).first() is None

    def test_delete_cascades_to_test_sessions(self, client, db, neuro_user, neuro_headers):
        patient = _make_owned_patient(db, neuro_user)
        session = TestSession(patient_id=patient.id, test_type="TMT-A")
        session.set_raw_data({"tiempo_segundos": 60})
        db.add(session)
        db.commit()
        session_id = session.id

        client.delete(f"/api/patients/{patient.id}", headers=neuro_headers)

        assert db.query(TestSession).filter(TestSession.id == session_id).first() is None

    def test_delete_cascades_to_execution_plans(self, client, db, neuro_user, neuro_headers):
        patient = _make_owned_patient(db, neuro_user)
        plan = ExecutionPlan(
            patient_id=patient.id,
            test_customizations=json.dumps([]),
            status="active",
            mode="live",
        )
        db.add(plan)
        db.commit()
        plan_id = plan.id

        client.delete(f"/api/patients/{patient.id}", headers=neuro_headers)

        assert db.query(ExecutionPlan).filter(ExecutionPlan.id == plan_id).first() is None

    def test_delete_cascades_to_access_grants(self, client, db, neuro_user, observer_user, neuro_headers):
        patient = _make_owned_patient(db, neuro_user)
        db.add(PatientAccess(patient_id=patient.id, user_id=observer_user.id,
                             granted_by_id=neuro_user.id))
        db.commit()

        client.delete(f"/api/patients/{patient.id}", headers=neuro_headers)

        remaining = db.query(PatientAccess).filter(PatientAccess.patient_id == patient.id).count()
        assert remaining == 0

    def test_delete_patient_with_all_related_data(self, client, db, neuro_user, observer_user, neuro_headers):
        """Full cascade: patient with plans, sessions, and access grants is fully removed."""
        patient = _make_owned_patient(db, neuro_user)

        plan = ExecutionPlan(
            patient_id=patient.id,
            test_customizations=json.dumps([]),
            status="completed",
            mode="live",
        )
        db.add(plan)
        db.flush()

        session = TestSession(patient_id=patient.id, test_type="TAVEC",
                              execution_plan_id=plan.id)
        session.set_raw_data({"ensayo_1": 5})
        db.add(session)
        db.add(PatientAccess(patient_id=patient.id, user_id=observer_user.id,
                             granted_by_id=neuro_user.id))
        db.commit()

        patient_id = patient.id
        r = client.delete(f"/api/patients/{patient_id}", headers=neuro_headers)
        assert r.status_code == 204

        assert db.query(Patient).filter(Patient.id == patient_id).first() is None
        assert db.query(ExecutionPlan).filter(ExecutionPlan.patient_id == patient_id).count() == 0
        assert db.query(TestSession).filter(TestSession.patient_id == patient_id).count() == 0
        assert db.query(PatientAccess).filter(PatientAccess.patient_id == patient_id).count() == 0


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

class TestDeletePatientAudit:
    def test_delete_creates_audit_log_entry(self, client, db, neuro_user, neuro_headers):
        from app.models.audit_log import AuditLog
        patient = _make_owned_patient(db, neuro_user)
        patient_id = patient.id
        db.commit()

        before = db.query(AuditLog).filter(AuditLog.user_id == neuro_user.id).count()
        client.delete(f"/api/patients/{patient_id}", headers=neuro_headers)
        after = db.query(AuditLog).filter(AuditLog.user_id == neuro_user.id).count()

        assert after == before + 1

    def test_audit_log_contains_action_patient_delete(self, client, db, neuro_user, neuro_headers):
        from app.models.audit_log import AuditLog
        patient = _make_owned_patient(db, neuro_user)
        patient_id = patient.id
        db.commit()

        client.delete(f"/api/patients/{patient_id}", headers=neuro_headers)
        log = db.query(AuditLog).filter(
            AuditLog.user_id == neuro_user.id,
            AuditLog.action == "patient.delete",
        ).first()

        assert log is not None
        assert log.resource_id == patient_id
