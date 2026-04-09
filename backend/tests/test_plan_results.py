"""
Tests for GET /api/execution-plans/{plan_id}/results and
GET /api/execution-plans/incomplete.

These endpoints were previously untested.
"""
import pytest
import json
from app.models.execution_plan import ExecutionPlan
from app.models.test_session import TestSession
from app.models.patient import Patient


# ---------------------------------------------------------------------------
# GET /api/execution-plans/{plan_id}/results
# ---------------------------------------------------------------------------

class TestGetPlanResults:
    def test_empty_plan_returns_empty_test_results(self, client, neuro_headers, sample_plan):
        r = client.get(f"/api/execution-plans/{sample_plan.id}/results", headers=neuro_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == sample_plan.id
        assert data["test_results"] == []

    def test_results_contain_expected_keys(self, client, neuro_headers, sample_plan):
        r = client.get(f"/api/execution-plans/{sample_plan.id}/results", headers=neuro_headers)
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert "patient_id" in data
        assert "protocol_id" in data
        assert "protocol_name" in data
        assert "status" in data
        assert "mode" in data
        assert "test_results" in data

    def test_results_include_saved_test_sessions(self, client, db, neuro_headers, sample_plan, sample_patient):
        session = TestSession(
            patient_id=sample_patient.id,
            test_type="TMT-A",
            execution_plan_id=sample_plan.id,
        )
        session.set_raw_data({"tiempo_segundos": 55})
        session.set_calculated_scores({"puntuacion_escalar": 10, "percentil": 50.0,
                                        "z_score": 0.0, "clasificacion": "Normal",
                                        "norma_aplicada": {"fuente": "NEURONORMA"}})
        db.add(session)
        db.commit()

        r = client.get(f"/api/execution-plans/{sample_plan.id}/results", headers=neuro_headers)
        assert r.status_code == 200
        results = r.json()["test_results"]
        assert len(results) == 1
        assert results[0]["test_type"] == "TMT-A"
        assert results[0]["raw_data"]["tiempo_segundos"] == 55
        assert results[0]["calculated_scores"]["clasificacion"] == "Normal"

    def test_multiple_sessions_ordered_by_date(self, client, db, neuro_headers, sample_plan, sample_patient):
        from datetime import datetime, timedelta, timezone
        base = datetime.now(timezone.utc)
        for i, test_type in enumerate(["TAVEC", "TMT-A", "Fluidez-FAS"]):
            s = TestSession(
                patient_id=sample_patient.id,
                test_type=test_type,
                execution_plan_id=sample_plan.id,
                date=base + timedelta(minutes=i),
            )
            s.set_raw_data({"score": i})
            db.add(s)
        db.commit()

        r = client.get(f"/api/execution-plans/{sample_plan.id}/results", headers=neuro_headers)
        assert r.status_code == 200
        types = [t["test_type"] for t in r.json()["test_results"]]
        assert types == ["TAVEC", "TMT-A", "Fluidez-FAS"]

    def test_plan_without_protocol_returns_null_protocol_name(self, client, db, neuro_headers, sample_patient):
        plan = ExecutionPlan(
            patient_id=sample_patient.id,
            protocol_id=None,
            test_customizations=json.dumps([]),
            status="active",
            mode="live",
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)

        r = client.get(f"/api/execution-plans/{plan.id}/results", headers=neuro_headers)
        assert r.status_code == 200
        assert r.json()["protocol_name"] is None

    def test_nonexistent_plan_returns_404(self, client, neuro_headers):
        r = client.get("/api/execution-plans/does-not-exist/results", headers=neuro_headers)
        assert r.status_code == 404

    def test_unauthenticated_returns_401(self, client, sample_plan):
        r = client.get(f"/api/execution-plans/{sample_plan.id}/results")
        assert r.status_code == 401

    def test_observer_without_access_returns_403(self, client, db, admin_user, sample_plan):
        """Observer who has no patient access cannot see plan results."""
        # Create a patient owned by admin — observer has no access grant
        owned_patient = Patient(age=60, education_years=10, laterality="diestro",
                                created_by_id=admin_user.id)
        db.add(owned_patient)
        db.flush()
        plan = ExecutionPlan(
            patient_id=owned_patient.id,
            protocol_id=None,
            test_customizations=json.dumps([]),
            status="active",
            mode="live",
        )
        db.add(plan)
        db.commit()

        from app.models.user import User
        from app.enums import UserRole
        from app.auth.password import hash_password
        other_obs = User(
            username="other_observer",
            hashed_password=hash_password("Test1234!Pass"),
            role=UserRole.OBSERVER,
            is_active=True,
        )
        db.add(other_obs)
        db.commit()
        login = client.post("/api/auth/login", json={"username": "other_observer", "password": "Test1234!Pass"})
        h = {"Authorization": f"Bearer {login.json()['access_token']}"}

        r = client.get(f"/api/execution-plans/{plan.id}/results", headers=h)
        assert r.status_code == 403

    def test_admin_can_view_any_plan_results(self, client, admin_headers, sample_plan):
        r = client.get(f"/api/execution-plans/{sample_plan.id}/results", headers=admin_headers)
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/execution-plans/incomplete
# ---------------------------------------------------------------------------

class TestGetIncompletePlans:
    def test_returns_list_of_active_plans(self, client, neuro_headers, sample_plan):
        r = client.get("/api/execution-plans/incomplete", headers=neuro_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert any(p["id"] == sample_plan.id for p in data)

    def test_completed_plans_excluded(self, client, db, neuro_headers, sample_plan):
        sample_plan.status = "completed"
        db.commit()

        r = client.get("/api/execution-plans/incomplete", headers=neuro_headers)
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert sample_plan.id not in ids

    def test_draft_plans_included(self, client, db, neuro_headers, sample_plan):
        sample_plan.status = "draft"
        db.commit()

        r = client.get("/api/execution-plans/incomplete", headers=neuro_headers)
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert sample_plan.id in ids

    def test_response_contains_expected_keys(self, client, neuro_headers, sample_plan):
        r = client.get("/api/execution-plans/incomplete", headers=neuro_headers)
        assert r.status_code == 200
        item = next(p for p in r.json() if p["id"] == sample_plan.id)
        assert "id" in item
        assert "patient_id" in item
        assert "status" in item
        assert "test_count" in item
        assert "total_tests" in item

    def test_observer_scoped_to_accessible_patients(self, client, db, admin_user, observer_user):
        """Observer can only see incomplete plans for patients they can access."""
        # Patient owned by admin — observer has no access
        owned_patient = Patient(age=55, education_years=8, laterality="zurdo",
                                created_by_id=admin_user.id)
        db.add(owned_patient)
        db.flush()
        plan = ExecutionPlan(
            patient_id=owned_patient.id,
            protocol_id=None,
            test_customizations=json.dumps([]),
            status="active",
            mode="live",
        )
        db.add(plan)
        db.commit()

        login = client.post("/api/auth/login", json={"username": "observer_test", "password": "Test1234!Pass"})
        h = {"Authorization": f"Bearer {login.json()['access_token']}"}

        r = client.get("/api/execution-plans/incomplete", headers=h)
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert plan.id not in ids

    def test_unauthenticated_returns_401(self, client):
        r = client.get("/api/execution-plans/incomplete")
        assert r.status_code == 401
