import pytest

VALID_PATIENT = {"age": 65, "education_years": 12, "laterality": "diestro", "initials": "JMR"}

class TestListPatients:
    def test_neuropsicólogo_can_list_patients(self, client, neuro_headers, sample_patient):
        res = client.get("/api/patients/", headers=neuro_headers)
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) == 1

    def test_observador_can_list_patients(self, client, observer_headers, sample_patient):
        res = client.get("/api/patients/", headers=observer_headers)
        assert res.status_code == 200

    def test_unauthenticated_cannot_list(self, client):
        res = client.get("/api/patients/")
        assert res.status_code == 401

    def test_display_id_format_with_initials(self, client, neuro_headers, sample_patient):
        res = client.get("/api/patients/", headers=neuro_headers)
        patient = res.json()[0]
        assert "JMR" in patient["display_id"]

    def test_display_id_format_without_initials(self, client, neuro_headers, db):
        from app.models.patient import Patient
        p = Patient(age=70, education_years=8, laterality="zurdo")
        db.add(p); db.commit()
        res = client.get("/api/patients/", headers=neuro_headers)
        patients = res.json()
        no_initials = next(p for p in patients if p["initials"] is None)
        assert no_initials["display_id"].startswith("PKT-")

class TestCreatePatient:
    def test_neuropsicólogo_can_create(self, client, neuro_headers):
        res = client.post("/api/patients/", json=VALID_PATIENT, headers=neuro_headers)
        assert res.status_code == 201
        assert res.json()["age"] == 65
        assert res.json()["display_id"] is not None

    def test_admin_can_create(self, client, admin_headers):
        res = client.post("/api/patients/", json=VALID_PATIENT, headers=admin_headers)
        assert res.status_code == 201

    def test_observador_cannot_create(self, client, observer_headers):
        res = client.post("/api/patients/", json=VALID_PATIENT, headers=observer_headers)
        assert res.status_code == 403

    def test_invalid_laterality_rejected(self, client, neuro_headers):
        bad = {**VALID_PATIENT, "laterality": "invalid"}
        res = client.post("/api/patients/", json=bad, headers=neuro_headers)
        assert res.status_code == 422

    def test_invalid_age_rejected(self, client, neuro_headers):
        bad = {**VALID_PATIENT, "age": 200}
        res = client.post("/api/patients/", json=bad, headers=neuro_headers)
        assert res.status_code == 422

    def test_missing_required_fields_rejected(self, client, neuro_headers):
        res = client.post("/api/patients/", json={"age": 65}, headers=neuro_headers)
        assert res.status_code == 422

class TestGetPatient:
    def test_get_existing_patient(self, client, neuro_headers, sample_patient):
        res = client.get(f"/api/patients/{sample_patient.id}", headers=neuro_headers)
        assert res.status_code == 200
        assert res.json()["id"] == sample_patient.id

    def test_get_nonexistent_patient(self, client, neuro_headers):
        res = client.get("/api/patients/nonexistent-id", headers=neuro_headers)
        assert res.status_code == 404

class TestUpdatePatient:
    def test_neuropsicólogo_can_update(self, client, neuro_headers, sample_patient):
        res = client.put(f"/api/patients/{sample_patient.id}", json={"age": 70}, headers=neuro_headers)
        assert res.status_code == 200
        assert res.json()["age"] == 70

    def test_observador_cannot_update(self, client, observer_headers, sample_patient):
        res = client.put(f"/api/patients/{sample_patient.id}", json={"age": 70}, headers=observer_headers)
        assert res.status_code == 403

class TestDeletePatient:
    def test_admin_can_delete(self, client, admin_headers, sample_patient):
        res = client.delete(f"/api/patients/{sample_patient.id}", headers=admin_headers)
        assert res.status_code == 204

    def test_neuropsicólogo_cannot_delete(self, client, neuro_headers, sample_patient):
        res = client.delete(f"/api/patients/{sample_patient.id}", headers=neuro_headers)
        assert res.status_code == 403

class TestPatientSessions:
    def test_get_sessions_for_patient(self, client, neuro_headers, sample_patient, db):
        from app.models.test_session import TestSession
        s = TestSession(patient_id=sample_patient.id, test_type="TMT-A")
        s.set_raw_data({"tiempo_segundos": 45})
        db.add(s); db.commit()
        res = client.get(f"/api/patients/{sample_patient.id}/sessions", headers=neuro_headers)
        assert res.status_code == 200
        assert len(res.json()) == 1
        assert res.json()[0]["test_type"] == "TMT-A"

    def test_sessions_empty_for_new_patient(self, client, neuro_headers, sample_patient):
        res = client.get(f"/api/patients/{sample_patient.id}/sessions", headers=neuro_headers)
        assert res.status_code == 200
        assert res.json() == []
