import pytest
import json
from app.models.test_session import TestSession
from app.models.execution_plan import ExecutionPlan


# ---------------------------------------------------------------------------
# /api/stats/overview
# ---------------------------------------------------------------------------

def test_overview_returns_200_with_keys(client, admin_headers):
    r = client.get("/api/stats/overview", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert "total_patients" in data
    assert "tests_this_week" in data
    assert "active_protocols" in data
    assert "completed_this_month" in data


def test_overview_counts_reflect_patient(client, admin_headers, sample_patient):
    r = client.get("/api/stats/overview", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["total_patients"] >= 1


def test_overview_counts_reflect_protocol(client, admin_headers, sample_protocol):
    r = client.get("/api/stats/overview", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["active_protocols"] >= 1


def test_overview_unauthenticated_returns_401(client):
    r = client.get("/api/stats/overview")
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# /api/stats/recent-plans
# ---------------------------------------------------------------------------

def test_recent_plans_returns_list(client, admin_headers, sample_plan):
    r = client.get("/api/stats/recent-plans", headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) >= 1


def test_recent_plans_includes_display_id_and_protocol_name(client, admin_headers, sample_plan):
    r = client.get("/api/stats/recent-plans", headers=admin_headers)
    assert r.status_code == 200
    item = r.json()[0]
    assert "patient_display_id" in item
    assert "protocol_name" in item
    assert item["protocol_name"] == "Rastreio Cognitivo"
    assert item["patient_display_id"] != ""


def test_recent_plans_max_10(client, db, admin_headers, sample_patient, sample_protocol):
    """Even with 15 plans, only 10 are returned."""
    for _ in range(15):
        plan = ExecutionPlan(
            patient_id=sample_patient.id,
            protocol_id=sample_protocol.id,
            test_customizations=json.dumps([]),
            status="active",
            mode="live",
        )
        db.add(plan)
    db.commit()

    r = client.get("/api/stats/recent-plans", headers=admin_headers)
    assert r.status_code == 200
    assert len(r.json()) <= 10


# ---------------------------------------------------------------------------
# /api/stats/classification-distribution
# ---------------------------------------------------------------------------

def test_classification_distribution_returns_all_4_keys(client, admin_headers):
    r = client.get("/api/stats/classification-distribution", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    keys = {item["clasificacion"] for item in data}
    assert keys == {"Superior", "Normal", "Limítrofe", "Deficitario"}


def test_classification_distribution_counts_correctly(client, db, admin_headers, sample_patient):
    session = TestSession(
        patient_id=sample_patient.id,
        test_type="TMT-A",
    )
    session.set_calculated_scores({
        "puntuacion_escalar": 13,
        "percentil": 84.0,
        "z_score": 1.0,
        "clasificacion": "Superior",
        "norma_aplicada": {"fuente": "NEURONORMA"},
    })
    db.add(session)
    db.commit()

    r = client.get("/api/stats/classification-distribution", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    superior_count = next(i["count"] for i in data if i["clasificacion"] == "Superior")
    assert superior_count > 0


def test_observer_can_access_all_stats_endpoints(client, observer_headers, sample_plan):
    for path in ["/api/stats/overview", "/api/stats/recent-plans", "/api/stats/classification-distribution"]:
        r = client.get(path, headers=observer_headers)
        assert r.status_code == 200, f"{path} returned {r.status_code}"
