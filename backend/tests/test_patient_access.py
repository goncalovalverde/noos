"""
QA: Patient access control routes.

Tests cover:
  - GET /patients/{id}/access — list who has access
  - POST /patients/{id}/access — grant access to another user
  - DELETE /patients/{id}/access/{user_id} — revoke access
  - Authorization rules (creator vs admin vs third-party neuro)
  - Idempotency of grant
  - Revocation of creator's own access is blocked
  - After revocation, user loses access to patient
"""
import pytest
from app.models.patient import Patient
from app.models.patient_access import PatientAccess
from app.auth.password import hash_password
from app.auth.jwt import create_access_token
from app.models.user import User
from app.enums import UserRole


def _headers(user: User) -> dict:
    token = create_access_token({"sub": user.id, "role": user.role})
    return {"Authorization": f"Bearer {token}"}


def _make_neuro(db, username="neuro2") -> User:
    u = User(username=username, hashed_password=hash_password("Test1234!Pass"),
             role=UserRole.NEURO, is_active=True)
    db.add(u); db.commit(); db.refresh(u)
    return u


# ─── GET /patients/{id}/access ─────────────────────────────────────────────

class TestGetPatientAccess:

    def test_creator_can_view_access_list(self, client, neuro_headers, neuro_user, db):
        patient = Patient(age=65, education_years=12, laterality="diestro",
                          created_by_id=neuro_user.id)
        db.add(patient); db.commit()
        db.add(PatientAccess(patient_id=patient.id, user_id=neuro_user.id,
                             granted_by_id=neuro_user.id)); db.commit()

        resp = client.get(f"/api/patients/{patient.id}/access", headers=neuro_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1

    def test_admin_can_view_any_access_list(self, client, admin_headers, neuro_user, db):
        patient = Patient(age=65, education_years=12, laterality="diestro",
                          created_by_id=neuro_user.id)
        db.add(patient); db.commit()

        resp = client.get(f"/api/patients/{patient.id}/access", headers=admin_headers)
        assert resp.status_code == 200

    def test_non_creator_neuro_cannot_view_access_list(self, client, neuro_user, db):
        other_neuro = _make_neuro(db, "other_neuro")
        patient = Patient(age=65, education_years=12, laterality="diestro",
                          created_by_id=neuro_user.id)
        db.add(patient); db.commit()

        resp = client.get(f"/api/patients/{patient.id}/access",
                          headers=_headers(other_neuro))
        # other_neuro is not the creator and has no access → 403 from _assert_access
        assert resp.status_code == 403

    def test_access_list_entry_has_expected_fields(self, client, admin_headers, neuro_user, db):
        patient = Patient(age=65, education_years=12, laterality="diestro",
                          created_by_id=neuro_user.id)
        db.add(patient); db.commit()
        db.add(PatientAccess(patient_id=patient.id, user_id=neuro_user.id,
                             granted_by_id=neuro_user.id)); db.commit()

        resp = client.get(f"/api/patients/{patient.id}/access", headers=admin_headers)
        entry = resp.json()[0]
        assert "user_id" in entry
        assert "username" in entry
        assert "granted_at" in entry
        assert "is_creator" in entry

    def test_get_access_nonexistent_patient_returns_404(self, client, admin_headers):
        resp = client.get("/api/patients/nonexistent-id/access", headers=admin_headers)
        assert resp.status_code == 404


# ─── POST /patients/{id}/access — grant ────────────────────────────────────

class TestGrantPatientAccess:

    def test_creator_can_grant_access_to_another_user(self, client, neuro_headers, neuro_user, db):
        other = _make_neuro(db, "grantee")
        patient = Patient(age=65, education_years=12, laterality="diestro",
                          created_by_id=neuro_user.id)
        db.add(patient); db.commit()

        resp = client.post(f"/api/patients/{patient.id}/access",
                           json={"user_id": other.id}, headers=neuro_headers)
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_admin_can_grant_access(self, client, admin_headers, neuro_user, db):
        grantee = _make_neuro(db, "grantee2")
        patient = Patient(age=65, education_years=12, laterality="diestro",
                          created_by_id=neuro_user.id)
        db.add(patient); db.commit()

        resp = client.post(f"/api/patients/{patient.id}/access",
                           json={"user_id": grantee.id}, headers=admin_headers)
        assert resp.status_code == 200

    def test_grant_is_idempotent(self, client, neuro_headers, neuro_user, db):
        """Granting the same user twice must not create duplicate rows or error."""
        grantee = _make_neuro(db, "idempotent_grantee")
        patient = Patient(age=65, education_years=12, laterality="diestro",
                          created_by_id=neuro_user.id)
        db.add(patient); db.commit()

        resp1 = client.post(f"/api/patients/{patient.id}/access",
                            json={"user_id": grantee.id}, headers=neuro_headers)
        resp2 = client.post(f"/api/patients/{patient.id}/access",
                            json={"user_id": grantee.id}, headers=neuro_headers)
        assert resp1.status_code == 200
        assert resp2.status_code == 200  # Idempotent — no error on repeat

        # Only one row in access table
        rows = db.query(PatientAccess).filter(
            PatientAccess.patient_id == patient.id,
            PatientAccess.user_id == grantee.id,
        ).count()
        assert rows == 1

    def test_grant_to_nonexistent_user_returns_404(self, client, neuro_headers, neuro_user, db):
        patient = Patient(age=65, education_years=12, laterality="diestro",
                          created_by_id=neuro_user.id)
        db.add(patient); db.commit()

        resp = client.post(f"/api/patients/{patient.id}/access",
                           json={"user_id": "00000000-0000-0000-0000-000000000000"},
                           headers=neuro_headers)
        assert resp.status_code == 404

    def test_non_creator_neuro_cannot_grant_access(self, client, neuro_user, db):
        third_neuro = _make_neuro(db, "third_neuro")
        grantee = _make_neuro(db, "grantee_3")
        patient = Patient(age=65, education_years=12, laterality="diestro",
                          created_by_id=neuro_user.id)
        db.add(patient); db.commit()

        resp = client.post(f"/api/patients/{patient.id}/access",
                           json={"user_id": grantee.id}, headers=_headers(third_neuro))
        assert resp.status_code == 403

    def test_granted_user_can_then_access_patient(self, client, neuro_headers, neuro_user, db):
        grantee = _make_neuro(db, "access_grantee")
        patient = Patient(age=65, education_years=12, laterality="diestro",
                          created_by_id=neuro_user.id)
        db.add(patient); db.commit()

        # Before grant — should not have access
        before = client.get(f"/api/patients/{patient.id}", headers=_headers(grantee))
        assert before.status_code == 403

        # Grant access
        client.post(f"/api/patients/{patient.id}/access",
                    json={"user_id": grantee.id}, headers=neuro_headers)

        # After grant — should have access
        after = client.get(f"/api/patients/{patient.id}", headers=_headers(grantee))
        assert after.status_code == 200


# ─── DELETE /patients/{id}/access/{user_id} — revoke ───────────────────────

class TestRevokePatientAccess:

    def test_creator_can_revoke_granted_access(self, client, neuro_headers, neuro_user, db):
        grantee = _make_neuro(db, "revoke_target")
        patient = Patient(age=65, education_years=12, laterality="diestro",
                          created_by_id=neuro_user.id)
        db.add(patient); db.commit()
        db.add(PatientAccess(patient_id=patient.id, user_id=grantee.id,
                             granted_by_id=neuro_user.id)); db.commit()

        resp = client.delete(f"/api/patients/{patient.id}/access/{grantee.id}",
                             headers=neuro_headers)
        assert resp.status_code == 204

    def test_revoked_user_loses_access(self, client, neuro_headers, neuro_user, db):
        grantee = _make_neuro(db, "revoked_user")
        patient = Patient(age=65, education_years=12, laterality="diestro",
                          created_by_id=neuro_user.id)
        db.add(patient); db.commit()
        db.add(PatientAccess(patient_id=patient.id, user_id=grantee.id,
                             granted_by_id=neuro_user.id)); db.commit()

        # Verify access before revoke
        before = client.get(f"/api/patients/{patient.id}", headers=_headers(grantee))
        assert before.status_code == 200

        # Revoke
        client.delete(f"/api/patients/{patient.id}/access/{grantee.id}",
                      headers=neuro_headers)

        # Access denied after revoke
        after = client.get(f"/api/patients/{patient.id}", headers=_headers(grantee))
        assert after.status_code == 403

    def test_cannot_revoke_creator_access(self, client, neuro_headers, neuro_user, db):
        """Revoking the creator's own access must return 400."""
        patient = Patient(age=65, education_years=12, laterality="diestro",
                          created_by_id=neuro_user.id)
        db.add(patient); db.commit()

        resp = client.delete(f"/api/patients/{patient.id}/access/{neuro_user.id}",
                             headers=neuro_headers)
        assert resp.status_code == 400
        assert "creador" in resp.json()["detail"].lower()

    def test_admin_can_revoke_any_access(self, client, admin_headers, neuro_user, db):
        grantee = _make_neuro(db, "admin_revoke_target")
        patient = Patient(age=65, education_years=12, laterality="diestro",
                          created_by_id=neuro_user.id)
        db.add(patient); db.commit()
        db.add(PatientAccess(patient_id=patient.id, user_id=grantee.id,
                             granted_by_id=neuro_user.id)); db.commit()

        resp = client.delete(f"/api/patients/{patient.id}/access/{grantee.id}",
                             headers=admin_headers)
        assert resp.status_code == 204

    def test_non_creator_neuro_cannot_revoke(self, client, neuro_user, db):
        interloper = _make_neuro(db, "interloper")
        grantee = _make_neuro(db, "someone")
        patient = Patient(age=65, education_years=12, laterality="diestro",
                          created_by_id=neuro_user.id)
        db.add(patient); db.commit()
        db.add(PatientAccess(patient_id=patient.id, user_id=grantee.id,
                             granted_by_id=neuro_user.id)); db.commit()

        # interloper tries to revoke — they have no access at all → 403
        resp = client.delete(f"/api/patients/{patient.id}/access/{grantee.id}",
                             headers=_headers(interloper))
        assert resp.status_code == 403
