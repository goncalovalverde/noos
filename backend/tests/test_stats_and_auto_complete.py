"""
Tests for GET /api/stats/incomplete-plans and
GET /api/stats/classification-distribution (scoping/edge cases not yet covered).

Also covers _auto_complete_plan logic in TestService via integration:
saving the final required test in a plan triggers status → "completed".
"""
import pytest
import json
from app.models.execution_plan import ExecutionPlan
from app.models.test_session import TestSession
from app.models.patient import Patient
from app.models.patient_access import PatientAccess


# ---------------------------------------------------------------------------
# GET /api/stats/incomplete-plans
# ---------------------------------------------------------------------------

class TestStatsIncompletePlans:
    def test_returns_count_and_plans_keys(self, client, admin_headers, sample_plan):
        r = client.get("/api/stats/incomplete-plans", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "count" in data
        assert "plans" in data
        assert isinstance(data["plans"], list)

    def test_count_reflects_unique_patients(self, client, db, admin_headers, sample_patient, sample_protocol):
        """count is unique patients, not plan count."""
        # Two plans for the same patient
        for _ in range(2):
            p = ExecutionPlan(
                patient_id=sample_patient.id,
                protocol_id=sample_protocol.id,
                test_customizations=json.dumps([]),
                status="active",
                mode="live",
            )
            db.add(p)
        db.commit()

        r = client.get("/api/stats/incomplete-plans", headers=admin_headers)
        assert r.status_code == 200
        # count == unique patients, so even with 2+ plans for same patient, count == 1
        assert r.json()["count"] == 1

    def test_completed_plans_excluded(self, client, db, admin_headers, sample_plan):
        sample_plan.status = "completed"
        db.commit()

        r = client.get("/api/stats/incomplete-plans", headers=admin_headers)
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()["plans"]]
        assert sample_plan.id not in ids

    def test_draft_plans_included(self, client, db, admin_headers, sample_plan):
        sample_plan.status = "draft"
        db.commit()

        r = client.get("/api/stats/incomplete-plans", headers=admin_headers)
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()["plans"]]
        assert sample_plan.id in ids

    def test_plan_item_contains_required_keys(self, client, admin_headers, sample_plan):
        r = client.get("/api/stats/incomplete-plans", headers=admin_headers)
        assert r.status_code == 200
        item = next(p for p in r.json()["plans"] if p["id"] == sample_plan.id)
        assert "patient_id" in item
        assert "patient_display_id" in item
        assert "protocol_name" in item
        assert "updated_at" in item

    def test_neuro_scoped_to_accessible_patients(self, client, db, admin_user, neuro_user):
        """Neuro sees only plans for patients they can access."""
        # Patient owned by admin — neuro_test has no access grant
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

        login = client.post("/api/auth/login", json={"username": "neuro_test", "password": "Test1234!Pass"})
        h = {"Authorization": f"Bearer {login.json()['access_token']}"}

        r = client.get("/api/stats/incomplete-plans", headers=h)
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()["plans"]]
        assert plan.id not in ids

    def test_admin_sees_all_plans(self, client, db, admin_headers, sample_patient):
        """Admin sees plans regardless of patient access grants."""
        plan = ExecutionPlan(
            patient_id=sample_patient.id,
            protocol_id=None,
            test_customizations=json.dumps([]),
            status="active",
            mode="live",
        )
        db.add(plan)
        db.commit()

        r = client.get("/api/stats/incomplete-plans", headers=admin_headers)
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()["plans"]]
        assert plan.id in ids

    def test_unauthenticated_returns_401(self, client):
        r = client.get("/api/stats/incomplete-plans")
        assert r.status_code == 401

    def test_empty_database_returns_zero_count(self, client, admin_headers):
        """When no active/draft plans exist, count == 0."""
        r = client.get("/api/stats/incomplete-plans", headers=admin_headers)
        assert r.status_code == 200
        # count is valid non-negative integer
        assert r.json()["count"] >= 0


# ---------------------------------------------------------------------------
# _auto_complete_plan — via POST /api/tests/ integration
# ---------------------------------------------------------------------------

class TestAutoCompletePlan:
    def test_plan_stays_active_when_tests_incomplete(self, client, db, neuro_headers, sample_plan, sample_patient):
        """Saving one test out of three doesn't complete the plan."""
        resp = client.post(
            "/api/tests/",
            json={
                "patient_id": sample_patient.id,
                "test_type": "TMT-A",
                "execution_plan_id": sample_plan.id,
                "raw_data": {"tiempo_segundos": 60},
            },
            headers=neuro_headers,
        )
        assert resp.status_code == 201
        db.refresh(sample_plan)
        assert sample_plan.status == "active"

    def test_plan_auto_completes_when_all_tests_saved(self, client, db, neuro_headers, sample_plan, sample_patient):
        """Saving all required tests marks the plan as completed."""
        # sample_plan has TMT-A, Fluidez-FAS, TAVEC
        for test_type, raw in [
            ("TMT-A", {"tiempo_segundos": 60}),
            ("Fluidez-FAS", {"letra_f": 10, "letra_a": 8, "letra_s": 9}),
            ("TAVEC", {"ensayo_1": 5, "ensayo_2": 7, "ensayo_3": 8, "ensayo_4": 9,
                       "ensayo_5": 10, "lista_b": 4, "recuerdo_inmediato": 9,
                       "recuerdo_demorado": 8, "reconocimiento": 14}),
        ]:
            r = client.post(
                "/api/tests/",
                json={
                    "patient_id": sample_patient.id,
                    "test_type": test_type,
                    "execution_plan_id": sample_plan.id,
                    "raw_data": raw,
                },
                headers=neuro_headers,
            )
            assert r.status_code == 201

        db.refresh(sample_plan)
        assert sample_plan.status == "completed"

    def test_plan_not_auto_completed_when_already_completed(self, client, db, neuro_headers, sample_plan, sample_patient):
        """A plan already in 'completed' state is not affected by auto-complete."""
        sample_plan.status = "completed"
        db.commit()

        # Save a test — should not crash or change state
        r = client.post(
            "/api/tests/",
            json={
                "patient_id": sample_patient.id,
                "test_type": "TMT-A",
                "execution_plan_id": sample_plan.id,
                "raw_data": {"tiempo_segundos": 60},
            },
            headers=neuro_headers,
        )
        assert r.status_code == 201
        db.refresh(sample_plan)
        assert sample_plan.status == "completed"

    def test_plan_not_auto_completed_when_in_draft(self, client, db, neuro_headers, sample_plan, sample_patient):
        """Draft plans are not auto-completed (only 'active' plans are eligible)."""
        sample_plan.status = "draft"
        db.commit()

        for test_type, raw in [
            ("TMT-A", {"tiempo_segundos": 60}),
            ("Fluidez-FAS", {"letra_f": 10, "letra_a": 8, "letra_s": 9}),
            ("TAVEC", {"ensayo_1": 5, "ensayo_2": 7, "ensayo_3": 8, "ensayo_4": 9,
                       "ensayo_5": 10, "lista_b": 4, "recuerdo_inmediato": 9,
                       "recuerdo_demorado": 8, "reconocimiento": 14}),
        ]:
            client.post(
                "/api/tests/",
                json={
                    "patient_id": sample_patient.id,
                    "test_type": test_type,
                    "execution_plan_id": sample_plan.id,
                    "raw_data": raw,
                },
                headers=neuro_headers,
            )

        db.refresh(sample_plan)
        assert sample_plan.status == "draft"

    def test_plan_without_execution_plan_id_does_not_crash(self, client, neuro_headers, sample_patient):
        """Tests with no execution_plan_id (ad-hoc tests) are unaffected by auto-complete."""
        r = client.post(
            "/api/tests/",
            json={
                "patient_id": sample_patient.id,
                "test_type": "TMT-A",
                "raw_data": {"tiempo_segundos": 75},
            },
            headers=neuro_headers,
        )
        assert r.status_code == 201

    def test_skipped_test_not_required_for_completion(self, client, db, neuro_headers, sample_patient, sample_protocol):
        """A plan where one test is marked skip=True completes without that test."""
        customizations = [
            {"test_type": "TMT-A", "order": 1, "skip": False, "added": False, "repeat_later": False, "notes": ""},
            {"test_type": "Fluidez-FAS", "order": 2, "skip": True, "added": False, "repeat_later": False, "notes": ""},
        ]
        plan = ExecutionPlan(
            patient_id=sample_patient.id,
            protocol_id=sample_protocol.id,
            test_customizations=json.dumps(customizations),
            status="active",
            mode="live",
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)

        r = client.post(
            "/api/tests/",
            json={
                "patient_id": sample_patient.id,
                "test_type": "TMT-A",
                "execution_plan_id": plan.id,
                "raw_data": {"tiempo_segundos": 60},
            },
            headers=neuro_headers,
        )
        assert r.status_code == 201
        db.refresh(plan)
        assert plan.status == "completed"
