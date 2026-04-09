"""
Tests for POST /api/auth/change-password.

Separate from PATCH /users/me (which also changes password via ProfileUpdate).
This endpoint uses ChangePasswordRequest with current_password + new_password.
"""
import pytest
from app.auth.password import hash_password
from app.models.user import User
from app.enums import UserRole
from app.main import limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
def fresh_user(db):
    """A user whose password we can freely change without affecting other fixtures."""
    u = User(
        username="cp_test_user",
        hashed_password=hash_password("OldPassword12!"),
        role=UserRole.NEURO,
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def fresh_headers(client, fresh_user):
    resp = client.post("/api/auth/login", json={"username": "cp_test_user", "password": "OldPassword12!"})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

class TestChangePasswordHappyPath:
    def test_correct_current_password_succeeds(self, client, fresh_headers):
        r = client.post(
            "/api/auth/change-password",
            json={"current_password": "OldPassword12!", "new_password": "NewPassword99@"},
            headers=fresh_headers,
        )
        assert r.status_code == 200
        assert r.json()["message"] == "Contraseña actualizada"

    def test_new_password_is_persisted(self, client, db, fresh_user, fresh_headers):
        client.post(
            "/api/auth/change-password",
            json={"current_password": "OldPassword12!", "new_password": "NewPassword99@"},
            headers=fresh_headers,
        )
        r = client.post("/api/auth/login", json={"username": "cp_test_user", "password": "NewPassword99@"})
        assert r.status_code == 200

    def test_old_password_rejected_after_change(self, client, fresh_headers):
        client.post(
            "/api/auth/change-password",
            json={"current_password": "OldPassword12!", "new_password": "NewPassword99@"},
            headers=fresh_headers,
        )
        r = client.post("/api/auth/login", json={"username": "cp_test_user", "password": "OldPassword12!"})
        assert r.status_code == 401

    def test_change_password_creates_audit_log(self, client, db, fresh_user, fresh_headers):
        from app.models.audit_log import AuditLog
        before_count = db.query(AuditLog).filter(AuditLog.user_id == fresh_user.id).count()
        client.post(
            "/api/auth/change-password",
            json={"current_password": "OldPassword12!", "new_password": "NewPassword99@"},
            headers=fresh_headers,
        )
        after_count = db.query(AuditLog).filter(AuditLog.user_id == fresh_user.id).count()
        assert after_count == before_count + 1


# ---------------------------------------------------------------------------
# Wrong / missing current password
# ---------------------------------------------------------------------------

class TestChangePasswordWrongCurrent:
    def test_wrong_current_password_returns_400(self, client, fresh_headers):
        r = client.post(
            "/api/auth/change-password",
            json={"current_password": "WrongPassword1!", "new_password": "NewPassword99@"},
            headers=fresh_headers,
        )
        assert r.status_code == 400

    def test_wrong_current_password_does_not_change_hash(self, client, db, fresh_user, fresh_headers):
        original_hash = fresh_user.hashed_password
        client.post(
            "/api/auth/change-password",
            json={"current_password": "WrongPassword1!", "new_password": "NewPassword99@"},
            headers=fresh_headers,
        )
        db.refresh(fresh_user)
        assert fresh_user.hashed_password == original_hash

    def test_empty_current_password_returns_422(self, client, fresh_headers):
        r = client.post(
            "/api/auth/change-password",
            json={"current_password": "", "new_password": "NewPassword99@"},
            headers=fresh_headers,
        )
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# Weak new password
# ---------------------------------------------------------------------------

class TestChangePasswordWeakNew:
    def test_short_new_password_returns_422(self, client, fresh_headers):
        # min_length=12 enforced by Pydantic before the handler runs
        r = client.post(
            "/api/auth/change-password",
            json={"current_password": "OldPassword12!", "new_password": "Short1!"},
            headers=fresh_headers,
        )
        assert r.status_code == 422

    def test_no_uppercase_returns_400(self, client, fresh_headers):
        r = client.post(
            "/api/auth/change-password",
            json={"current_password": "OldPassword12!", "new_password": "alllowercase12!"},
            headers=fresh_headers,
        )
        assert r.status_code == 400

    def test_no_digit_returns_400(self, client, fresh_headers):
        r = client.post(
            "/api/auth/change-password",
            json={"current_password": "OldPassword12!", "new_password": "NoDigitHereABC!"},
            headers=fresh_headers,
        )
        assert r.status_code == 400

    def test_no_symbol_returns_400(self, client, fresh_headers):
        r = client.post(
            "/api/auth/change-password",
            json={"current_password": "OldPassword12!", "new_password": "NoSymbolHere12"},
            headers=fresh_headers,
        )
        assert r.status_code == 400

    def test_new_password_too_long_returns_422(self, client, fresh_headers):
        r = client.post(
            "/api/auth/change-password",
            json={"current_password": "OldPassword12!", "new_password": "A1!" + "x" * 254},
            headers=fresh_headers,
        )
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# Auth / access control
# ---------------------------------------------------------------------------

class TestChangePasswordAuth:
    def test_unauthenticated_returns_401(self, client):
        r = client.post(
            "/api/auth/change-password",
            json={"current_password": "OldPassword12!", "new_password": "NewPassword99@"},
        )
        assert r.status_code == 401

    def test_deactivated_user_returns_401(self, client, db, fresh_user):
        # Get token BEFORE deactivating
        r = client.post("/api/auth/login", json={"username": "cp_test_user", "password": "OldPassword12!"})
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        fresh_user.is_active = False
        db.commit()

        r = client.post(
            "/api/auth/change-password",
            json={"current_password": "OldPassword12!", "new_password": "NewPassword99@"},
            headers=headers,
        )
        assert r.status_code == 401
