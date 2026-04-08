import pytest


def test_admin_can_list_users(client, admin_headers, admin_user):
    resp = client.get("/api/users/", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert any(u["username"] == "admin_test" for u in data)


def test_neuro_cannot_list_users(client, neuro_headers):
    resp = client.get("/api/users/", headers=neuro_headers)
    assert resp.status_code == 403


def test_observer_cannot_list_users(client, observer_headers):
    resp = client.get("/api/users/", headers=observer_headers)
    assert resp.status_code == 403


def test_admin_can_create_user(client, admin_headers):
    resp = client.post(
        "/api/users/",
        json={
            "username": "newuser",
            "password": "Secure1234!Pass",
            "email": "new@test.com",
            "full_name": "New User",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["username"] == "newuser"
    assert data["full_name"] == "New User"


def test_duplicate_username_409(client, admin_headers):
    payload = {"username": "dupeuser", "password": "Secure1234!Pass"}
    client.post("/api/users/", json=payload, headers=admin_headers)
    resp = client.post("/api/users/", json=payload, headers=admin_headers)
    assert resp.status_code == 409


def test_weak_password_400(client, admin_headers):
    resp = client.post(
        "/api/users/",
        json={"username": "weakpw", "password": "abcdefghijkl"},  # 12 chars but no upper/digit/symbol
        headers=admin_headers,
    )
    assert resp.status_code == 400


def test_neuro_cannot_create_user(client, neuro_headers):
    resp = client.post(
        "/api/users/",
        json={"username": "someuser", "password": "Secure1234!Pass"},
        headers=neuro_headers,
    )
    assert resp.status_code == 403


def test_admin_can_update_user_role(client, admin_headers, neuro_user):
    resp = client.patch(
        f"/api/users/{neuro_user.id}",
        json={"role": "Observador"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "Observador"


def test_admin_can_toggle_can_manage_protocols(client, admin_headers, neuro_user):
    resp = client.patch(
        f"/api/users/{neuro_user.id}",
        json={"can_manage_protocols": True},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["can_manage_protocols"] is True


def test_admin_can_deactivate_user(client, admin_headers, neuro_user):
    resp = client.patch(
        f"/api/users/{neuro_user.id}",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_update_nonexistent_user_404(client, admin_headers):
    resp = client.patch(
        "/api/users/nonexistent-id",
        json={"role": "Observador"},
        headers=admin_headers,
    )
    assert resp.status_code == 404


def test_neuro_cannot_update(client, neuro_headers, admin_user):
    resp = client.patch(
        f"/api/users/{admin_user.id}",
        json={"role": "Observador"},
        headers=neuro_headers,
    )
    assert resp.status_code == 403


def test_admin_can_delete_user(client, admin_headers, neuro_user):
    resp = client.delete(f"/api/users/{neuro_user.id}", headers=admin_headers)
    assert resp.status_code == 204


def test_delete_nonexistent_user_404(client, admin_headers):
    resp = client.delete("/api/users/nonexistent-id", headers=admin_headers)
    assert resp.status_code == 404


def test_observer_cannot_delete(client, observer_headers, neuro_user):
    resp = client.delete(f"/api/users/{neuro_user.id}", headers=observer_headers)
    assert resp.status_code == 403
