"""
QA: User profile self-service (PATCH /users/me) and admin self-deletion guard (CR-1).

Tests cover:
  - Admin cannot delete their own account
  - Email update (happy path, duplicate conflict)
  - Password change (happy path, wrong current, weak new, missing current)
  - Deactivated user cannot authenticate
  - PATCH /me with no body is a no-op (not an error)
  - GET /me returns current user
"""
import pytest
from app.models.user import User
from app.auth.password import hash_password
from app.auth.jwt import create_access_token
from app.enums import UserRole
from app.core.limiter import limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset the in-memory rate limiter before every test in this module.

    PATCH /users/me has a 5/minute limit. Without this reset, sequential
    tests exhaust the counter and all subsequent calls return 429.
    """
    limiter.reset()
    yield
    limiter.reset()


# ─── GET /users/me ─────────────────────────────────────────────────────────

class TestGetMyProfile:

    def test_authenticated_user_gets_own_profile(self, client, admin_headers, admin_user):
        resp = client.get("/api/users/me", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "admin_test"
        assert data["role"] == UserRole.ADMIN

    def test_unauthenticated_returns_401(self, client):
        resp = client.get("/api/users/me")
        assert resp.status_code == 401

    def test_response_contains_expected_fields(self, client, neuro_headers, neuro_user):
        resp = client.get("/api/users/me", headers=neuro_headers)
        assert resp.status_code == 200
        data = resp.json()
        for field in ("id", "username", "role", "can_manage_protocols", "is_active", "created_at"):
            assert field in data, f"Field '{field}' missing from /users/me response"

    def test_password_hash_not_exposed_in_response(self, client, admin_headers):
        resp = client.get("/api/users/me", headers=admin_headers)
        body = resp.text
        assert "hashed_password" not in body
        assert "$2b$" not in body  # bcrypt hash prefix


# ─── PATCH /users/me — email update ────────────────────────────────────────

class TestUpdateMyEmail:

    def test_user_can_update_own_email(self, client, neuro_headers):
        resp = client.patch("/api/users/me",
                            json={"email": "neuro@example.com"},
                            headers=neuro_headers)
        assert resp.status_code == 200
        assert resp.json()["email"] == "neuro@example.com"

    def test_email_update_persists(self, client, neuro_headers):
        client.patch("/api/users/me", json={"email": "saved@example.com"}, headers=neuro_headers)
        resp = client.get("/api/users/me", headers=neuro_headers)
        assert resp.json()["email"] == "saved@example.com"

    def test_duplicate_email_returns_409(self, client, admin_headers, neuro_headers, db):
        # Give admin an email first
        client.patch("/api/users/me", json={"email": "taken@example.com"}, headers=admin_headers)
        # Neuro tries to take the same email
        resp = client.patch("/api/users/me", json={"email": "taken@example.com"},
                            headers=neuro_headers)
        assert resp.status_code == 409

    def test_invalid_email_format_returns_422(self, client, neuro_headers):
        resp = client.patch("/api/users/me",
                            json={"email": "not-an-email"},
                            headers=neuro_headers)
        assert resp.status_code == 422

    def test_empty_patch_body_is_noop(self, client, neuro_headers):
        """Sending no fields should succeed and return current user unchanged."""
        resp = client.patch("/api/users/me", json={}, headers=neuro_headers)
        assert resp.status_code == 200


# ─── PATCH /users/me — password change ─────────────────────────────────────

class TestChangeMyPassword:

    def test_user_can_change_password_with_correct_current(self, client, neuro_headers, neuro_user, db):
        resp = client.patch("/api/users/me", json={
            "current_password": "Test1234!Pass",
            "new_password": "NewSecure99!Pass",
        }, headers=neuro_headers)
        assert resp.status_code == 200

        # New password works for login
        login = client.post("/api/auth/login",
                            json={"username": "neuro_test", "password": "NewSecure99!Pass"})
        assert login.status_code == 200

    def test_wrong_current_password_returns_400(self, client, neuro_headers):
        resp = client.patch("/api/users/me", json={
            "current_password": "WrongPassword1!",
            "new_password": "NewSecure99!Pass",
        }, headers=neuro_headers)
        assert resp.status_code == 400
        assert "actual" in resp.json()["detail"].lower()

    def test_new_password_without_current_returns_400(self, client, neuro_headers):
        resp = client.patch("/api/users/me", json={
            "new_password": "NewSecure99!Pass",
        }, headers=neuro_headers)
        assert resp.status_code == 400

    def test_weak_new_password_returns_400(self, client, neuro_headers):
        resp = client.patch("/api/users/me", json={
            "current_password": "Test1234!Pass",
            "new_password": "tooshort1!A",  # 11 chars — below 12 min
        }, headers=neuro_headers)
        assert resp.status_code == 422  # Pydantic min_length=12

    def test_new_password_no_symbol_returns_400(self, client, neuro_headers):
        resp = client.patch("/api/users/me", json={
            "current_password": "Test1234!Pass",
            "new_password": "NoSymbolPassw0rd",  # 16 chars, no symbol
        }, headers=neuro_headers)
        assert resp.status_code == 400

    def test_old_password_no_longer_works_after_change(self, client, neuro_headers):
        client.patch("/api/users/me", json={
            "current_password": "Test1234!Pass",
            "new_password": "NewSecure99!Pass",
        }, headers=neuro_headers)

        old_login = client.post("/api/auth/login",
                                json={"username": "neuro_test", "password": "Test1234!Pass"})
        assert old_login.status_code == 401


# ─── CR-1: Admin cannot delete their own account ───────────────────────────

class TestAdminSelfDeletion:

    def test_admin_cannot_delete_their_own_account(self, client, admin_headers, admin_user):
        """CR-1 guard: DELETE /users/{own_id} must return 400."""
        resp = client.delete(f"/api/users/{admin_user.id}", headers=admin_headers)
        assert resp.status_code == 400
        assert "propia cuenta" in resp.json()["detail"]

    def test_admin_can_still_delete_other_users(self, client, admin_headers, neuro_user):
        resp = client.delete(f"/api/users/{neuro_user.id}", headers=admin_headers)
        assert resp.status_code == 204

    def test_neuro_self_delete_still_403(self, client, neuro_headers, neuro_user):
        """Non-admins can't delete anyone, including themselves — must stay 403."""
        resp = client.delete(f"/api/users/{neuro_user.id}", headers=neuro_headers)
        assert resp.status_code == 403


# ─── Deactivated user cannot authenticate ──────────────────────────────────

class TestDeactivatedUser:

    def test_deactivated_user_cannot_log_in(self, client, admin_headers, neuro_user):
        # Deactivate
        client.patch(f"/api/users/{neuro_user.id}", json={"is_active": False},
                     headers=admin_headers)
        # Attempt login
        resp = client.post("/api/auth/login",
                           json={"username": "neuro_test", "password": "Test1234!Pass"})
        assert resp.status_code == 401

    def test_deactivated_user_token_no_longer_valid(self, client, admin_headers,
                                                      neuro_user, neuro_headers):
        """Token issued before deactivation should fail on next request that re-fetches user."""
        # Issue token while active
        valid_headers = dict(neuro_headers)

        # Deactivate
        client.patch(f"/api/users/{neuro_user.id}", json={"is_active": False},
                     headers=admin_headers)

        # Previously-issued token hits DB which checks is_active=True
        resp = client.get("/api/users/me", headers=valid_headers)
        assert resp.status_code == 401

    def test_reactivated_user_can_log_in_again(self, client, admin_headers, neuro_user):
        client.patch(f"/api/users/{neuro_user.id}", json={"is_active": False},
                     headers=admin_headers)
        client.patch(f"/api/users/{neuro_user.id}", json={"is_active": True},
                     headers=admin_headers)

        resp = client.post("/api/auth/login",
                           json={"username": "neuro_test", "password": "Test1234!Pass"})
        assert resp.status_code == 200


# ─── UserOut schema doesn't expose sensitive fields ────────────────────────

class TestUserOutSchema:

    def test_admin_list_does_not_expose_passwords(self, client, admin_headers, neuro_user):
        resp = client.get("/api/users/", headers=admin_headers)
        body = resp.text
        assert "hashed_password" not in body
        assert "$2b$" not in body

    def test_created_at_present_in_user_list(self, client, admin_headers, neuro_user):
        resp = client.get("/api/users/", headers=admin_headers)
        users = resp.json()
        for u in users:
            assert "created_at" in u
