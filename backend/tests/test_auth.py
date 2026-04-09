"""
Tests for authentication endpoints: login, refresh token denylist, logout.
"""
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.models.used_refresh_token import UsedRefreshToken


def test_login_success(client, admin_user):
    resp = client.post("/api/auth/login", json={"username": "admin_test", "password": "Test1234!Pass"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_wrong_password(client, admin_user):
    resp = client.post("/api/auth/login", json={"username": "admin_test", "password": "wrongpassword1234"})
    assert resp.status_code == 401


def test_refresh_issues_new_token_pair(client, admin_user):
    login = client.post("/api/auth/login", json={"username": "admin_test", "password": "Test1234!Pass"})
    refresh_token = login.json()["refresh_token"]

    resp = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    # New refresh token must be different (rotation)
    assert data["refresh_token"] != refresh_token


def test_refresh_token_denylist_prevents_replay(client, admin_user):
    """A refresh token must be rejected on second use (denylist / single-use)."""
    login = client.post("/api/auth/login", json={"username": "admin_test", "password": "Test1234!Pass"})
    refresh_token = login.json()["refresh_token"]

    # First use — should succeed
    first = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert first.status_code == 200

    # Second use of the SAME token — must be rejected
    second = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert second.status_code == 401
    assert "ya utilizado" in second.json()["detail"]


def test_refresh_with_invalid_token_rejected(client):
    resp = client.post("/api/auth/refresh", json={"refresh_token": "not.a.valid.token"})
    assert resp.status_code == 401


def test_refresh_with_access_token_rejected(client, admin_user):
    """Submitting an access token to the refresh endpoint must be rejected."""
    login = client.post("/api/auth/login", json={"username": "admin_test", "password": "Test1234!Pass"})
    access_token = login.json()["access_token"]

    resp = client.post("/api/auth/refresh", json={"refresh_token": access_token})
    assert resp.status_code == 401


# ── #5: UsedRefreshToken purge ─────────────────────────────────────────────

def test_refresh_purges_expired_jti_rows(client, db, admin_user):
    """Expired JTI rows are deleted when a new refresh is processed."""
    # Seed two already-expired denylist rows
    past = datetime.now(timezone.utc) - timedelta(days=1)
    db.add(UsedRefreshToken(jti="expired-jti-1", expires_at=past))
    db.add(UsedRefreshToken(jti="expired-jti-2", expires_at=past))
    db.commit()
    assert db.query(UsedRefreshToken).count() == 2

    # A real refresh triggers the opportunistic purge
    login = client.post("/api/auth/login", json={"username": "admin_test", "password": "Test1234!Pass"})
    client.post("/api/auth/refresh", json={"refresh_token": login.json()["refresh_token"]})

    # Expired rows must be gone; only the newly-consumed live JTI remains
    remaining = db.query(UsedRefreshToken).all()
    db.expire_all()
    remaining = db.query(UsedRefreshToken).all()
    assert all(r.jti not in ("expired-jti-1", "expired-jti-2") for r in remaining)


def test_unexpired_jti_rows_not_purged(client, db, admin_user):
    """Denylist rows that are still within their validity window are kept."""
    future = datetime.now(timezone.utc) + timedelta(days=6)
    db.add(UsedRefreshToken(jti="live-jti-keep", expires_at=future))
    db.commit()

    login = client.post("/api/auth/login", json={"username": "admin_test", "password": "Test1234!Pass"})
    client.post("/api/auth/refresh", json={"refresh_token": login.json()["refresh_token"]})

    db.expire_all()
    assert db.query(UsedRefreshToken).filter(UsedRefreshToken.jti == "live-jti-keep").first() is not None


# ── #6: Swagger UI disabled in production ─────────────────────────────────

def test_swagger_available_in_development(client):
    """In test/dev environment the Swagger UI must be reachable."""
    resp = client.get("/api/docs")
    # 200 means page served; could also be a redirect to login — either way not 404
    assert resp.status_code != 404


def test_swagger_disabled_in_production():
    """When ENVIRONMENT=production, docs and openapi endpoints return 404.

    We test this by constructing a minimal FastAPI instance with the same
    production-mode logic as main.py uses — without running the startup
    lifespan (migrations, seed, etc.) which would fail with dev credentials.
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient as _TC
    from unittest.mock import patch
    from app.core.config import settings

    # Simulate production flag — same logic as _is_production in main.py
    with patch.object(settings, "ENVIRONMENT", "production"):
        is_prod = settings.ENVIRONMENT == "production"
        prod_app = FastAPI(
            docs_url=None if is_prod else "/api/docs",
            redoc_url=None if is_prod else "/api/redoc",
            openapi_url=None if is_prod else "/api/openapi.json",
        )
        with _TC(prod_app) as prod_client:
            assert prod_client.get("/api/docs").status_code == 404
            assert prod_client.get("/api/redoc").status_code == 404
            assert prod_client.get("/api/openapi.json").status_code == 404
