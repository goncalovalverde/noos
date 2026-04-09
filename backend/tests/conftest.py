import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.db.base import Base, get_db
from app.auth.password import hash_password
from app.auth.jwt import create_access_token
from app.enums import UserRole
from app.models.user import User
from app.models.patient import Patient

# In-memory SQLite for tests
SQLALCHEMY_TEST_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def _make_user(db, username, role, can_manage_protocols=False):
    user = User(
        username=username,
        hashed_password=hash_password("Test1234!Pass"),
        role=role,
        can_manage_protocols=can_manage_protocols,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def _token_headers(user_id: str, role: str) -> dict:
    token = create_access_token({"sub": user_id, "role": role})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def admin_user(db):
    return _make_user(db, "admin_test", UserRole.ADMIN, can_manage_protocols=True)

@pytest.fixture
def neuro_user(db):
    return _make_user(db, "neuro_test", UserRole.NEURO)

@pytest.fixture
def observer_user(db):
    return _make_user(db, "observer_test", UserRole.OBSERVER)

@pytest.fixture
def admin_headers(admin_user):
    return _token_headers(admin_user.id, admin_user.role)

@pytest.fixture
def neuro_headers(neuro_user):
    return _token_headers(neuro_user.id, neuro_user.role)

@pytest.fixture
def observer_headers(observer_user):
    return _token_headers(observer_user.id, observer_user.role)

@pytest.fixture
def sample_patient(db):
    p = Patient(age=65, education_years=12, laterality="diestro", initials="JMR")
    db.add(p)
    db.commit()
    db.refresh(p)
    return p

@pytest.fixture
def sample_protocol(db):
    from app.models.protocol import Protocol, ProtocolTest
    p = Protocol(name="Rastreio Cognitivo", category="Rastreio")
    db.add(p); db.flush()
    for i, tt in enumerate(["TMT-A", "Fluidez-FAS", "TAVEC"], 1):
        db.add(ProtocolTest(protocol_id=p.id, test_type=tt, order=i))
    db.commit(); db.refresh(p)
    return p

@pytest.fixture
def sample_plan(db, sample_patient, sample_protocol):
    from app.models.execution_plan import ExecutionPlan
    import json
    customizations = [
        {"test_type": "TMT-A", "order": 1, "skip": False, "added": False, "repeat_later": False, "notes": ""},
        {"test_type": "Fluidez-FAS", "order": 2, "skip": False, "added": False, "repeat_later": False, "notes": ""},
        {"test_type": "TAVEC", "order": 3, "skip": False, "added": False, "repeat_later": False, "notes": ""},
    ]
    plan = ExecutionPlan(
        patient_id=sample_patient.id,
        protocol_id=sample_protocol.id,
        test_customizations=json.dumps(customizations),
        status="active",
        mode="live",
    )
    db.add(plan); db.commit(); db.refresh(plan)
    return plan
