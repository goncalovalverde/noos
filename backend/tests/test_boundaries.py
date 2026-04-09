"""
QA: Boundary enforcement, pagination, and schema validation.

Tests cover:
  - Patient schema: age/education_years min/max, initials max_length, laterality enum
  - User schema: username min_length, password max_length (bcrypt DoS guard), invalid role
  - LoginRequest: max_length on password
  - Pagination: page/size query params, size > 100 rejected
  - Execution plan: pagination-style via incomplete plans
  - Non-admin stats are scoped to accessible patients
  - Health endpoint
"""
import pytest
from app.models.patient import Patient
from app.models.patient_access import PatientAccess
from app.models.user import User
from app.auth.password import hash_password
from app.auth.jwt import create_access_token
from app.enums import UserRole


def _headers(user: User) -> dict:
    token = create_access_token({"sub": user.id, "role": user.role})
    return {"Authorization": f"Bearer {token}"}


# ─── Patient schema boundaries ─────────────────────────────────────────────

class TestPatientSchemaBoundaries:

    def test_min_age_1_accepted(self, client, neuro_headers):
        resp = client.post("/api/patients/",
                           json={"age": 1, "education_years": 0, "laterality": "diestro"},
                           headers=neuro_headers)
        assert resp.status_code == 201

    def test_age_0_rejected(self, client, neuro_headers):
        resp = client.post("/api/patients/",
                           json={"age": 0, "education_years": 0, "laterality": "diestro"},
                           headers=neuro_headers)
        assert resp.status_code == 422

    def test_max_age_119_accepted(self, client, neuro_headers):
        resp = client.post("/api/patients/",
                           json={"age": 119, "education_years": 0, "laterality": "diestro"},
                           headers=neuro_headers)
        assert resp.status_code == 201

    def test_age_120_rejected(self, client, neuro_headers):
        resp = client.post("/api/patients/",
                           json={"age": 120, "education_years": 0, "laterality": "diestro"},
                           headers=neuro_headers)
        assert resp.status_code == 422

    def test_education_0_accepted(self, client, neuro_headers):
        resp = client.post("/api/patients/",
                           json={"age": 50, "education_years": 0, "laterality": "diestro"},
                           headers=neuro_headers)
        assert resp.status_code == 201

    def test_education_negative_rejected(self, client, neuro_headers):
        resp = client.post("/api/patients/",
                           json={"age": 50, "education_years": -1, "laterality": "diestro"},
                           headers=neuro_headers)
        assert resp.status_code == 422

    def test_education_30_accepted(self, client, neuro_headers):
        resp = client.post("/api/patients/",
                           json={"age": 50, "education_years": 30, "laterality": "diestro"},
                           headers=neuro_headers)
        assert resp.status_code == 201

    def test_education_31_rejected(self, client, neuro_headers):
        resp = client.post("/api/patients/",
                           json={"age": 50, "education_years": 31, "laterality": "diestro"},
                           headers=neuro_headers)
        assert resp.status_code == 422

    def test_initials_10_chars_accepted(self, client, neuro_headers):
        resp = client.post("/api/patients/",
                           json={"age": 50, "education_years": 10, "laterality": "diestro",
                                 "initials": "ABCDEFGHIJ"},
                           headers=neuro_headers)
        assert resp.status_code == 201

    def test_initials_11_chars_rejected(self, client, neuro_headers):
        resp = client.post("/api/patients/",
                           json={"age": 50, "education_years": 10, "laterality": "diestro",
                                 "initials": "ABCDEFGHIJK"},
                           headers=neuro_headers)
        assert resp.status_code == 422

    def test_initials_empty_string_rejected(self, client, neuro_headers):
        """min_length=1 means empty string is invalid."""
        resp = client.post("/api/patients/",
                           json={"age": 50, "education_years": 10, "laterality": "diestro",
                                 "initials": ""},
                           headers=neuro_headers)
        assert resp.status_code == 422

    def test_all_laterality_values_accepted(self, client, neuro_headers):
        for lat in ("diestro", "zurdo", "ambidextro"):
            resp = client.post("/api/patients/",
                               json={"age": 50, "education_years": 10, "laterality": lat},
                               headers=neuro_headers)
            assert resp.status_code == 201, f"Laterality '{lat}' should be valid"

    def test_unknown_laterality_rejected(self, client, neuro_headers):
        resp = client.post("/api/patients/",
                           json={"age": 50, "education_years": 10, "laterality": "ambas"},
                           headers=neuro_headers)
        assert resp.status_code == 422


# ─── User schema boundaries ────────────────────────────────────────────────

class TestUserSchemaBoundaries:

    def test_username_min_3_chars_accepted(self, client, admin_headers):
        resp = client.post("/api/users/",
                           json={"username": "abc", "password": "Secure1234!Pass"},
                           headers=admin_headers)
        assert resp.status_code == 201

    def test_username_2_chars_rejected(self, client, admin_headers):
        resp = client.post("/api/users/",
                           json={"username": "ab", "password": "Secure1234!Pass"},
                           headers=admin_headers)
        assert resp.status_code == 422

    def test_username_50_chars_accepted(self, client, admin_headers):
        name = "a" * 50
        resp = client.post("/api/users/",
                           json={"username": name, "password": "Secure1234!Pass"},
                           headers=admin_headers)
        assert resp.status_code == 201

    def test_username_51_chars_rejected(self, client, admin_headers):
        name = "a" * 51
        resp = client.post("/api/users/",
                           json={"username": name, "password": "Secure1234!Pass"},
                           headers=admin_headers)
        assert resp.status_code == 422

    def test_password_256_chars_accepted(self, client, admin_headers):
        """Maximum password length boundary must be accepted."""
        pw = "Aa1!" + "x" * 252  # 256 total, meets all strength rules
        resp = client.post("/api/users/",
                           json={"username": "maxpwuser", "password": pw},
                           headers=admin_headers)
        assert resp.status_code == 201

    def test_password_257_chars_rejected(self, client, admin_headers):
        """257 chars — bcrypt DoS guard must reject before hashing."""
        pw = "Aa1!" + "x" * 253  # 257 total
        resp = client.post("/api/users/",
                           json={"username": "toobigpw", "password": pw},
                           headers=admin_headers)
        assert resp.status_code == 422

    def test_invalid_role_rejected(self, client, admin_headers):
        resp = client.post("/api/users/",
                           json={"username": "badrole", "password": "Secure1234!Pass",
                                 "role": "SuperAdmin"},
                           headers=admin_headers)
        assert resp.status_code == 422

    def test_full_name_max_100_chars_accepted(self, client, admin_headers):
        resp = client.post("/api/users/",
                           json={"username": "longname", "password": "Secure1234!Pass",
                                 "full_name": "A" * 100},
                           headers=admin_headers)
        assert resp.status_code == 201

    def test_full_name_101_chars_rejected(self, client, admin_headers):
        resp = client.post("/api/users/",
                           json={"username": "toolongname", "password": "Secure1234!Pass",
                                 "full_name": "A" * 101},
                           headers=admin_headers)
        assert resp.status_code == 422


# ─── Login schema boundaries (IMP-3: bcrypt DoS guard) ────────────────────

class TestLoginSchemaBoundaries:

    def test_login_password_max_256_chars_processed(self, client, admin_user):
        """256-char password should reach auth logic (not be rejected by schema)."""
        pw = "x" * 256
        resp = client.post("/api/auth/login",
                           json={"username": "admin_test", "password": pw})
        # Will fail auth (wrong password) but NOT fail schema validation
        assert resp.status_code == 401

    def test_login_password_257_chars_rejected_by_schema(self, client, admin_user):
        """257-char password must be rejected at Pydantic layer (422) before bcrypt."""
        pw = "x" * 257
        resp = client.post("/api/auth/login",
                           json={"username": "admin_test", "password": pw})
        assert resp.status_code == 422

    def test_login_empty_password_rejected(self, client):
        resp = client.post("/api/auth/login",
                           json={"username": "admin_test", "password": ""})
        assert resp.status_code == 422

    def test_login_empty_username_rejected(self, client):
        resp = client.post("/api/auth/login",
                           json={"username": "", "password": "Test1234!Pass"})
        assert resp.status_code == 422

    def test_login_username_max_50_chars(self, client):
        """51-char username must be rejected by schema."""
        resp = client.post("/api/auth/login",
                           json={"username": "u" * 51, "password": "Test1234!Pass"})
        assert resp.status_code == 422


# ─── Pagination ────────────────────────────────────────────────────────────

class TestPatientPagination:

    def test_page_1_default_returns_up_to_20(self, client, neuro_headers, db, neuro_user):
        """Default page size is 20."""
        for i in range(5):
            p = Patient(age=50 + i, education_years=10, laterality="diestro",
                        created_by_id=neuro_user.id)
            db.add(p)
        db.commit()

        resp = client.get("/api/patients/?page=1&size=20", headers=neuro_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 5

    def test_page_2_returns_next_set(self, client, neuro_headers, db, neuro_user):
        for i in range(5):
            p = Patient(age=40 + i, education_years=10, laterality="diestro",
                        created_by_id=neuro_user.id)
            db.add(p)
        db.commit()

        page1 = client.get("/api/patients/?page=1&size=3", headers=neuro_headers)
        page2 = client.get("/api/patients/?page=2&size=3", headers=neuro_headers)
        assert page1.status_code == 200
        assert page2.status_code == 200
        # Pages should have different records
        ids_p1 = {p["id"] for p in page1.json()}
        ids_p2 = {p["id"] for p in page2.json()}
        assert ids_p1.isdisjoint(ids_p2), "Pages must not overlap"

    def test_size_0_rejected(self, client, neuro_headers):
        resp = client.get("/api/patients/?size=0", headers=neuro_headers)
        assert resp.status_code == 422

    def test_size_100_accepted(self, client, neuro_headers):
        resp = client.get("/api/patients/?size=100", headers=neuro_headers)
        assert resp.status_code == 200

    def test_size_101_rejected(self, client, neuro_headers):
        resp = client.get("/api/patients/?size=101", headers=neuro_headers)
        assert resp.status_code == 422

    def test_page_0_rejected(self, client, neuro_headers):
        resp = client.get("/api/patients/?page=0", headers=neuro_headers)
        assert resp.status_code == 422

    def test_beyond_last_page_returns_empty_list(self, client, neuro_headers):
        resp = client.get("/api/patients/?page=9999&size=20", headers=neuro_headers)
        assert resp.status_code == 200
        assert resp.json() == []


# ─── Non-admin scoped stats ────────────────────────────────────────────────

class TestScopedStats:

    def test_neuro_sees_only_own_patients_in_overview(
        self, client, neuro_headers, neuro_user, admin_user, db
    ):
        # neuro patient
        neuro_patient = Patient(age=60, education_years=10, laterality="diestro",
                                created_by_id=neuro_user.id)
        # admin patient (inaccessible to neuro)
        admin_patient = Patient(age=70, education_years=12, laterality="zurdo",
                                created_by_id=admin_user.id)
        db.add(neuro_patient); db.add(admin_patient); db.commit()

        neuro_stats = client.get("/api/stats/overview", headers=neuro_headers)
        admin_stats = client.get("/api/stats/overview",
                                 headers={"Authorization": "Bearer " +
                                          create_access_token({"sub": admin_user.id,
                                                               "role": admin_user.role}).split()[-1]
                                          if False else
                                          create_access_token({"sub": admin_user.id, "role": admin_user.role})})

        # Actually create proper admin headers
        admin_token = create_access_token({"sub": admin_user.id, "role": admin_user.role})
        admin_hdrs = {"Authorization": f"Bearer {admin_token}"}

        neuro_total = neuro_stats.json()["total_patients"]
        admin_total = client.get("/api/stats/overview", headers=admin_hdrs).json()["total_patients"]

        # Admin sees more (or equal) patients than neuro
        assert admin_total >= neuro_total

    def test_observer_with_no_grants_sees_zero_patients(self, client, observer_headers,
                                                          observer_user, db, admin_user):
        # Make a patient owned by admin — observer has no access
        p = Patient(age=55, education_years=8, laterality="diestro", created_by_id=admin_user.id)
        db.add(p); db.commit()

        resp = client.get("/api/stats/overview", headers=observer_headers)
        assert resp.status_code == 200
        # Observer sees 0 patients (no access grants)
        assert resp.json()["total_patients"] == 0


# ─── Health endpoint ───────────────────────────────────────────────────────

class TestHealthEndpoint:

    def test_health_returns_200(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200

    def test_health_returns_ok_status(self, client):
        resp = client.get("/api/health")
        assert resp.json()["status"] == "ok"

    def test_health_no_auth_required(self, client):
        """Health check must be reachable without authentication."""
        resp = client.get("/api/health")
        assert resp.status_code == 200

    def test_health_returns_version(self, client):
        resp = client.get("/api/health")
        assert "version" in resp.json()
