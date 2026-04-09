"""
QA: /api/tests/ endpoint family — full coverage sweep.

Tests cover:
  - CRUD for TestSession
  - Access control (neuro vs observer vs admin)
  - Normative score calculation on create
  - Auto-complete execution plan when all tests saved
  - Boundary and negative inputs
"""
import pytest
from app.models.test_session import TestSession
from app.models.patient import Patient
from app.models.patient_access import PatientAccess


# ─── helpers ───────────────────────────────────────────────────────────────

def _tmt_payload(patient_id, plan_id=None):
    p = {
        "patient_id": patient_id,
        "test_type": "TMT-A",
        "raw_data": {"tiempo_segundos": 60},
    }
    if plan_id:
        p["execution_plan_id"] = plan_id
    return p


# ─── Create ────────────────────────────────────────────────────────────────

class TestCreateTestSession:

    def test_neuro_can_create_test_and_gets_scores(self, client, neuro_headers, neuro_user, db):
        """Happy path: creating a TMT-A session returns calculated normative scores."""
        patient = Patient(age=65, education_years=12, laterality="diestro", created_by_id=neuro_user.id)
        db.add(patient); db.commit()

        resp = client.post("/api/tests/", json=_tmt_payload(patient.id), headers=neuro_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["test_type"] == "TMT-A"
        scores = data["calculated_scores"]
        assert "puntuacion_escalar" in scores
        assert "percentil" in scores
        assert "clasificacion" in scores

    def test_admin_can_create_test(self, client, admin_headers, sample_patient):
        resp = client.post("/api/tests/", json=_tmt_payload(sample_patient.id), headers=admin_headers)
        assert resp.status_code == 201

    def test_observer_cannot_create_test(self, client, observer_headers, sample_patient):
        resp = client.post("/api/tests/", json=_tmt_payload(sample_patient.id), headers=observer_headers)
        assert resp.status_code == 403

    def test_unauthenticated_cannot_create_test(self, client, sample_patient):
        resp = client.post("/api/tests/", json=_tmt_payload(sample_patient.id))
        assert resp.status_code == 401

    def test_create_test_for_nonexistent_patient_returns_404(self, client, neuro_headers):
        resp = client.post("/api/tests/", json=_tmt_payload("00000000-0000-0000-0000-000000000000"),
                           headers=neuro_headers)
        assert resp.status_code == 404

    def test_neuro_cannot_create_test_for_inaccessible_patient(
        self, client, neuro_headers, admin_user, db
    ):
        """A neuro who did not create and was not granted access must get 403."""
        other_patient = Patient(age=55, education_years=10, laterality="zurdo",
                                created_by_id=admin_user.id)
        db.add(other_patient); db.commit()

        resp = client.post("/api/tests/", json=_tmt_payload(other_patient.id),
                           headers=neuro_headers)
        assert resp.status_code == 403

    def test_create_test_missing_required_raw_data_returns_422(self, client, neuro_headers, sample_patient):
        resp = client.post(
            "/api/tests/",
            json={"patient_id": sample_patient.id, "test_type": "TMT-A"},
            headers=neuro_headers,
        )
        assert resp.status_code == 422

    def test_create_test_with_qualitative_data(self, client, neuro_headers, neuro_user, db):
        patient = Patient(age=70, education_years=8, laterality="diestro", created_by_id=neuro_user.id)
        db.add(patient); db.commit()

        resp = client.post("/api/tests/", json={
            "patient_id": patient.id,
            "test_type": "TAVEC",
            "raw_data": {
                "ensayo_1": 6, "ensayo_2": 8, "ensayo_3": 9,
                "ensayo_4": 11, "ensayo_5": 12,
                "lista_b": 4,
                "recuerdo_inmediato": 11,
                "recuerdo_demorado": 10,
                "reconocimiento": 14,
            },
            "qualitative_data": {"observaciones": "Paciente colaborador"},
        }, headers=neuro_headers)
        assert resp.status_code == 201
        assert resp.json()["qualitative_data"]["observaciones"] == "Paciente colaborador"


# ─── Read ──────────────────────────────────────────────────────────────────

class TestGetTestSession:

    def test_get_test_by_id_returns_full_data(self, client, neuro_headers, neuro_user, db):
        patient = Patient(age=65, education_years=12, laterality="diestro", created_by_id=neuro_user.id)
        db.add(patient); db.commit()
        session = TestSession(patient_id=patient.id, test_type="TMT-A")
        session.set_raw_data({"tiempo_segundos": 45})
        db.add(session); db.commit()

        resp = client.get(f"/api/tests/{session.id}", headers=neuro_headers)
        assert resp.status_code == 200
        assert resp.json()["test_type"] == "TMT-A"
        assert resp.json()["raw_data"] == {"tiempo_segundos": 45}

    def test_get_nonexistent_test_returns_404(self, client, neuro_headers):
        resp = client.get("/api/tests/nonexistent-id", headers=neuro_headers)
        assert resp.status_code == 404

    def test_get_tests_by_patient_returns_list(self, client, neuro_headers, neuro_user, db):
        patient = Patient(age=65, education_years=12, laterality="diestro", created_by_id=neuro_user.id)
        db.add(patient); db.commit()
        for _ in range(3):
            s = TestSession(patient_id=patient.id, test_type="TMT-A")
            s.set_raw_data({"tiempo_segundos": 45})
            db.add(s)
        db.commit()

        resp = client.get(f"/api/tests/patient/{patient.id}", headers=neuro_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    def test_get_tests_by_nonexistent_patient_returns_404(self, client, neuro_headers):
        resp = client.get("/api/tests/patient/nonexistent-id", headers=neuro_headers)
        assert resp.status_code == 404

    def test_get_tests_by_inaccessible_patient_returns_403(
        self, client, neuro_headers, admin_user, db
    ):
        other = Patient(age=60, education_years=9, laterality="zurdo", created_by_id=admin_user.id)
        db.add(other); db.commit()

        resp = client.get(f"/api/tests/patient/{other.id}", headers=neuro_headers)
        assert resp.status_code == 403

    def test_observer_can_read_test_if_granted_access(
        self, client, observer_headers, observer_user, neuro_user, db
    ):
        patient = Patient(age=65, education_years=12, laterality="diestro", created_by_id=neuro_user.id)
        db.add(patient); db.commit()
        db.add(PatientAccess(patient_id=patient.id, user_id=observer_user.id,
                             granted_by_id=neuro_user.id)); db.commit()
        session = TestSession(patient_id=patient.id, test_type="TMT-A")
        session.set_raw_data({"tiempo_segundos": 45})
        db.add(session); db.commit()

        resp = client.get(f"/api/tests/{session.id}", headers=observer_headers)
        assert resp.status_code == 200


# ─── Update ────────────────────────────────────────────────────────────────

class TestUpdateTestSession:

    def test_neuro_can_update_raw_data_and_scores_recalculate(
        self, client, neuro_headers, neuro_user, db
    ):
        patient = Patient(age=65, education_years=12, laterality="diestro", created_by_id=neuro_user.id)
        db.add(patient); db.commit()
        session = TestSession(patient_id=patient.id, test_type="TMT-A")
        session.set_raw_data({"tiempo_segundos": 45})
        db.add(session); db.commit()

        resp = client.patch(
            f"/api/tests/{session.id}",
            json={"raw_data": {"tiempo_segundos": 120}},
            headers=neuro_headers,
        )
        assert resp.status_code == 200
        # Scores should be recalculated with new raw data
        assert resp.json()["raw_data"]["tiempo_segundos"] == 120
        assert "puntuacion_escalar" in resp.json()["calculated_scores"]

    def test_observer_cannot_update_test(self, client, observer_headers, neuro_user, db):
        patient = Patient(age=65, education_years=12, laterality="diestro", created_by_id=neuro_user.id)
        db.add(patient); db.commit()
        session = TestSession(patient_id=patient.id, test_type="TMT-A")
        session.set_raw_data({"tiempo_segundos": 45})
        db.add(session); db.commit()

        resp = client.patch(
            f"/api/tests/{session.id}",
            json={"raw_data": {"tiempo_segundos": 99}},
            headers=observer_headers,
        )
        assert resp.status_code == 403

    def test_update_nonexistent_test_returns_404(self, client, neuro_headers):
        resp = client.patch(
            "/api/tests/nonexistent-id",
            json={"raw_data": {"tiempo_segundos": 60}},
            headers=neuro_headers,
        )
        assert resp.status_code == 404


# ─── Delete ────────────────────────────────────────────────────────────────

class TestDeleteTestSession:

    def test_admin_can_delete_test(self, client, admin_headers, neuro_user, db):
        patient = Patient(age=65, education_years=12, laterality="diestro", created_by_id=neuro_user.id)
        db.add(patient); db.commit()
        session = TestSession(patient_id=patient.id, test_type="TMT-A")
        session.set_raw_data({"tiempo_segundos": 45})
        db.add(session); db.commit()

        resp = client.delete(f"/api/tests/{session.id}", headers=admin_headers)
        assert resp.status_code == 204

        # Verify gone
        check = client.get(f"/api/tests/{session.id}", headers=admin_headers)
        assert check.status_code == 404

    def test_neuro_cannot_delete_test(self, client, neuro_headers, neuro_user, db):
        patient = Patient(age=65, education_years=12, laterality="diestro", created_by_id=neuro_user.id)
        db.add(patient); db.commit()
        session = TestSession(patient_id=patient.id, test_type="TMT-A")
        session.set_raw_data({"tiempo_segundos": 45})
        db.add(session); db.commit()

        resp = client.delete(f"/api/tests/{session.id}", headers=neuro_headers)
        assert resp.status_code == 403

    def test_delete_nonexistent_test_returns_404(self, client, admin_headers):
        resp = client.delete("/api/tests/nonexistent-id", headers=admin_headers)
        assert resp.status_code == 404


# ─── Auto-complete execution plan ─────────────────────────────────────────

class TestAutoCompletePlan:

    def test_plan_auto_completes_when_all_tests_saved(
        self, client, neuro_headers, neuro_user, db, sample_protocol
    ):
        """When all non-skipped protocol tests are saved, plan status → completed."""
        patient = Patient(age=65, education_years=12, laterality="diestro", created_by_id=neuro_user.id)
        db.add(patient); db.commit()

        # Create and activate plan
        plan_resp = client.post("/api/execution-plans/", json={
            "patient_id": patient.id,
            "protocol_id": sample_protocol.id,
            "mode": "live",
        }, headers=neuro_headers)
        plan_id = plan_resp.json()["id"]
        client.patch(f"/api/execution-plans/{plan_id}", json={"status": "active"},
                     headers=neuro_headers)

        # Save all 3 tests from the protocol (TMT-A, Fluidez-FAS, TAVEC)
        for test_type, raw_data in [
            ("TMT-A", {"tiempo_segundos": 60}),
            ("Fluidez-FAS", {"letra_f": 10, "letra_a": 8, "letra_s": 9}),
            ("TAVEC", {
                "ensayo_1": 6, "ensayo_2": 8, "ensayo_3": 9, "ensayo_4": 11, "ensayo_5": 12,
                "lista_b": 4, "recuerdo_inmediato": 11, "recuerdo_demorado": 10, "reconocimiento": 14,
            }),
        ]:
            resp = client.post("/api/tests/", json={
                "patient_id": patient.id,
                "test_type": test_type,
                "execution_plan_id": plan_id,
                "raw_data": raw_data,
            }, headers=neuro_headers)
            assert resp.status_code == 201

        # Plan should be auto-completed
        plan_check = client.get(f"/api/execution-plans/{plan_id}", headers=neuro_headers)
        assert plan_check.json()["status"] == "completed"

    def test_incomplete_plan_stays_active_after_partial_tests(
        self, client, neuro_headers, neuro_user, db, sample_protocol
    ):
        """Plan stays active when only some tests are saved."""
        patient = Patient(age=65, education_years=12, laterality="diestro", created_by_id=neuro_user.id)
        db.add(patient); db.commit()

        plan_resp = client.post("/api/execution-plans/", json={
            "patient_id": patient.id,
            "protocol_id": sample_protocol.id,
            "mode": "live",
        }, headers=neuro_headers)
        plan_id = plan_resp.json()["id"]
        client.patch(f"/api/execution-plans/{plan_id}", json={"status": "active"},
                     headers=neuro_headers)

        # Save only 1 of 3 tests
        client.post("/api/tests/", json={
            "patient_id": patient.id,
            "test_type": "TMT-A",
            "execution_plan_id": plan_id,
            "raw_data": {"tiempo_segundos": 60},
        }, headers=neuro_headers)

        plan_check = client.get(f"/api/execution-plans/{plan_id}", headers=neuro_headers)
        assert plan_check.json()["status"] == "active"
