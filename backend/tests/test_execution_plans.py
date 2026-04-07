import pytest
import json

class TestCreateExecutionPlan:
    def test_creates_plan_from_protocol(self, client, neuro_headers, sample_patient, sample_protocol):
        res = client.post("/api/execution-plans/", json={
            "patient_id": sample_patient.id,
            "protocol_id": sample_protocol.id,
            "mode": "live"
        }, headers=neuro_headers)
        assert res.status_code == 201
        data = res.json()
        assert data["status"] == "draft"
        assert data["mode"] == "live"
        assert len(data["test_customizations"]) == 3

    def test_customizations_match_protocol_tests(self, client, neuro_headers, sample_patient, sample_protocol):
        res = client.post("/api/execution-plans/", json={
            "patient_id": sample_patient.id,
            "protocol_id": sample_protocol.id,
            "mode": "live"
        }, headers=neuro_headers)
        customizations = res.json()["test_customizations"]
        test_types = [c["test_type"] for c in customizations]
        assert "TMT-A" in test_types
        assert "Fluidez-FAS" in test_types
        assert "TAVEC" in test_types

    def test_invalid_protocol_returns_404(self, client, neuro_headers, sample_patient):
        res = client.post("/api/execution-plans/", json={
            "patient_id": sample_patient.id,
            "protocol_id": "nonexistent",
            "mode": "live"
        }, headers=neuro_headers)
        assert res.status_code == 404

    def test_observador_cannot_create(self, client, observer_headers, sample_patient, sample_protocol):
        res = client.post("/api/execution-plans/", json={
            "patient_id": sample_patient.id,
            "protocol_id": sample_protocol.id,
            "mode": "live"
        }, headers=observer_headers)
        assert res.status_code == 403

class TestUpdateExecutionPlan:
    def test_update_status_to_active(self, client, neuro_headers, sample_plan):
        res = client.patch(f"/api/execution-plans/{sample_plan.id}",
            json={"status": "active"}, headers=neuro_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "active"

    def test_update_status_to_completed(self, client, neuro_headers, sample_plan):
        res = client.patch(f"/api/execution-plans/{sample_plan.id}",
            json={"status": "completed"}, headers=neuro_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "completed"

    def test_update_customizations(self, client, neuro_headers, sample_plan):
        new_customizations = [
            {"test_type": "TMT-A", "order": 1, "skip": True, "added": False, "repeat_later": False, "notes": ""},
            {"test_type": "Fluidez-FAS", "order": 2, "skip": False, "added": False, "repeat_later": False, "notes": ""},
        ]
        res = client.patch(f"/api/execution-plans/{sample_plan.id}",
            json={"test_customizations": new_customizations}, headers=neuro_headers)
        assert res.status_code == 200
        skipped = [c for c in res.json()["test_customizations"] if c["skip"]]
        assert len(skipped) == 1
        assert skipped[0]["test_type"] == "TMT-A"

class TestGetExecutionPlansByPatient:
    def test_get_plans_for_patient(self, client, neuro_headers, sample_plan, sample_patient):
        res = client.get(f"/api/execution-plans/patient/{sample_patient.id}", headers=neuro_headers)
        assert res.status_code == 200
        assert len(res.json()) >= 1

    def test_plans_contain_customizations(self, client, neuro_headers, sample_plan, sample_patient):
        res = client.get(f"/api/execution-plans/patient/{sample_patient.id}", headers=neuro_headers)
        plan = res.json()[0]
        assert plan["test_customizations"] is not None
        assert len(plan["test_customizations"]) == 3

class TestFullEvaluationFlow:
    def test_complete_evaluation_flow(self, client, neuro_headers, sample_patient, sample_protocol):
        # 1. Create plan
        plan_res = client.post("/api/execution-plans/", json={
            "patient_id": sample_patient.id,
            "protocol_id": sample_protocol.id,
            "mode": "live"
        }, headers=neuro_headers)
        assert plan_res.status_code == 201
        plan_id = plan_res.json()["id"]

        # 2. Activate plan
        client.patch(f"/api/execution-plans/{plan_id}", json={"status": "active"}, headers=neuro_headers)

        # 3. Save TMT-A test
        test_res = client.post("/api/tests/", json={
            "patient_id": sample_patient.id,
            "execution_plan_id": plan_id,
            "test_type": "TMT-A",
            "raw_data": {"tiempo_segundos": 60}
        }, headers=neuro_headers)
        assert test_res.status_code == 201
        assert test_res.json()["calculated_scores"]["puntuacion_escalar"] is not None

        # 4. Complete plan
        complete_res = client.patch(f"/api/execution-plans/{plan_id}",
            json={"status": "completed"}, headers=neuro_headers)
        assert complete_res.json()["status"] == "completed"
