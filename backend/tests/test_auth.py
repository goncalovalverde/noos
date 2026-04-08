"""
Tests for authentication endpoints: login, refresh token denylist, logout.
"""
import pytest
from fastapi.testclient import TestClient


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
