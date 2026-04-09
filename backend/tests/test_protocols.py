import pytest
from app.auth.password import hash_password
from app.auth.jwt import create_access_token
from app.models.user import User
from app.enums import UserRole


def _make_neuro_manager(db):
    user = User(
        username="neuro_manager",
        hashed_password=hash_password("Test1234!Pass"),
        role=UserRole.NEURO,
        can_manage_protocols=True,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.id, "role": user.role})
    return {"Authorization": f"Bearer {token}"}


class TestListProtocols:
    def test_admin_can_list_returns_array(self, client, admin_headers, sample_protocol):
        r = client.get("/api/protocols/", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    def test_filter_by_category_returns_only_matching(self, client, admin_headers, sample_protocol, db):
        from app.models.protocol import Protocol
        p2 = Protocol(name="Memoria Protocol", category="Memoria")
        db.add(p2)
        db.commit()

        r = client.get("/api/protocols/?category=Rastreio", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all(p["category"] == "Rastreio" for p in data)

        r2 = client.get("/api/protocols/?category=Memoria", headers=admin_headers)
        assert r2.status_code == 200
        assert all(p["category"] == "Memoria" for p in r2.json())


class TestCreateProtocol:
    def test_admin_creates_protocol_with_tests(self, client, admin_headers):
        payload = {
            "name": "New Completo Protocol",
            "category": "Completo",
            "description": "Full battery",
            "tests": [
                {"test_type": "TMT-A", "order": 1},
                {"test_type": "TAVEC", "order": 2},
            ],
        }
        r = client.post("/api/protocols/", json=payload, headers=admin_headers)
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "New Completo Protocol"
        assert len(data["tests"]) == 2
        types = {t["test_type"] for t in data["tests"]}
        assert "TMT-A" in types
        assert "TAVEC" in types

    def test_create_duplicate_name_returns_409(self, client, admin_headers, sample_protocol):
        payload = {"name": "Rastreio Cognitivo", "tests": []}
        r = client.post("/api/protocols/", json=payload, headers=admin_headers)
        assert r.status_code == 409

    def test_neuro_without_permission_gets_403(self, client, neuro_headers):
        payload = {"name": "Should Fail", "tests": []}
        r = client.post("/api/protocols/", json=payload, headers=neuro_headers)
        assert r.status_code == 403

    def test_observer_cannot_create_403(self, client, observer_headers):
        payload = {"name": "Observer Protocol", "tests": []}
        r = client.post("/api/protocols/", json=payload, headers=observer_headers)
        assert r.status_code == 403

    def test_neuro_with_can_manage_protocols_can_create(self, client, db):
        headers = _make_neuro_manager(db)
        payload = {"name": "Neuro Manager Protocol", "tests": []}
        r = client.post("/api/protocols/", json=payload, headers=headers)
        assert r.status_code == 201


class TestReadProtocol:
    def test_observer_can_read_list(self, client, observer_headers, sample_protocol):
        r = client.get("/api/protocols/", headers=observer_headers)
        assert r.status_code == 200

    def test_get_by_id_returns_full_protocol_with_tests(self, client, admin_headers, sample_protocol):
        r = client.get(f"/api/protocols/{sample_protocol.id}", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Rastreio Cognitivo"
        assert len(data["tests"]) == 3

    def test_get_nonexistent_returns_404(self, client, admin_headers):
        r = client.get("/api/protocols/nonexistent-id", headers=admin_headers)
        assert r.status_code == 404


class TestUpdateProtocol:
    def test_admin_can_update_name_description_and_tests(self, client, admin_headers, sample_protocol):
        payload = {
            "name": "Updated Protocol Name",
            "description": "Updated description",
            "tests": [{"test_type": "TMT-B", "order": 1}],
        }
        r = client.put(f"/api/protocols/{sample_protocol.id}", json=payload, headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Updated Protocol Name"
        assert data["description"] == "Updated description"
        assert len(data["tests"]) == 1
        assert data["tests"][0]["test_type"] == "TMT-B"

    def test_update_without_permission_returns_403(self, client, neuro_headers, sample_protocol):
        payload = {"name": "Attempted Update"}
        r = client.put(f"/api/protocols/{sample_protocol.id}", json=payload, headers=neuro_headers)
        assert r.status_code == 403


class TestDeleteProtocol:
    def test_admin_can_delete_then_404(self, client, admin_headers, sample_protocol):
        r = client.delete(f"/api/protocols/{sample_protocol.id}", headers=admin_headers)
        assert r.status_code == 204

        r2 = client.get(f"/api/protocols/{sample_protocol.id}", headers=admin_headers)
        assert r2.status_code == 404

    def test_delete_without_permission_returns_403(self, client, neuro_headers, sample_protocol):
        r = client.delete(f"/api/protocols/{sample_protocol.id}", headers=neuro_headers)
        assert r.status_code == 403
