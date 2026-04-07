import pytest
from app.models.test_session import TestSession


# ---------- helpers ----------

def _make_session(db, plan, test_type='TMT-A', with_scores=True, with_notes=False):
    session = TestSession(
        patient_id=plan.patient_id,
        test_type=test_type,
        execution_plan_id=plan.id,
    )
    if with_scores:
        session.set_calculated_scores({
            'puntuacion_escalar': 10,
            'percentil': 50.0,
            'z_score': 0.0,
            'clasificacion': 'Normal',
            'norma_aplicada': {'fuente': 'NEURONORMA'},
        })
    session.set_raw_data({'tiempo': 45, 'errores': 0})
    session.set_qualitative_data(
        {'observaciones': 'Sin incidencias'} if with_notes else {'observaciones': ''}
    )
    db.add(session)
    db.commit()
    return session


# ---------- tests ----------

def test_pdf_report_returns_200(client, admin_headers, db, sample_plan):
    _make_session(db, sample_plan)
    r = client.get(f'/api/reports/{sample_plan.id}/pdf', headers=admin_headers)
    assert r.status_code == 200


def test_pdf_report_content_type(client, admin_headers, db, sample_plan):
    _make_session(db, sample_plan)
    r = client.get(f'/api/reports/{sample_plan.id}/pdf', headers=admin_headers)
    assert r.headers['content-type'] == 'application/pdf'


def test_pdf_report_non_zero_bytes(client, admin_headers, db, sample_plan):
    _make_session(db, sample_plan)
    r = client.get(f'/api/reports/{sample_plan.id}/pdf', headers=admin_headers)
    assert len(r.content) > 0


def test_word_report_returns_200(client, admin_headers, db, sample_plan):
    _make_session(db, sample_plan)
    r = client.get(f'/api/reports/{sample_plan.id}/word', headers=admin_headers)
    assert r.status_code == 200


def test_word_report_content_type(client, admin_headers, db, sample_plan):
    _make_session(db, sample_plan)
    r = client.get(f'/api/reports/{sample_plan.id}/word', headers=admin_headers)
    assert 'wordprocessingml' in r.headers['content-type']


def test_word_report_non_zero_bytes(client, admin_headers, db, sample_plan):
    _make_session(db, sample_plan)
    r = client.get(f'/api/reports/{sample_plan.id}/word', headers=admin_headers)
    assert len(r.content) > 0


def test_pdf_non_existent_plan_returns_404(client, admin_headers):
    r = client.get('/api/reports/non-existent-id/pdf', headers=admin_headers)
    assert r.status_code == 404


def test_word_non_existent_plan_returns_404(client, admin_headers):
    r = client.get('/api/reports/non-existent-id/word', headers=admin_headers)
    assert r.status_code == 404


def test_unauthenticated_pdf_returns_401(client, sample_plan):
    r = client.get(f'/api/reports/{sample_plan.id}/pdf')
    assert r.status_code == 401


def test_pdf_with_null_calculated_scores(client, admin_headers, db, sample_plan):
    """Edge case: paper mode, scores not yet calculated."""
    session = TestSession(
        patient_id=sample_plan.patient_id,
        test_type='TAVEC',
        execution_plan_id=sample_plan.id,
    )
    # Intentionally leave calculated_scores as None
    session.set_raw_data({'ensayo_1': 5})
    session.set_qualitative_data({'observaciones': ''})
    db.add(session)
    db.commit()

    r = client.get(f'/api/reports/{sample_plan.id}/pdf', headers=admin_headers)
    assert r.status_code == 200
    assert len(r.content) > 0
