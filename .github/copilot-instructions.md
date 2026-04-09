# Nóos — Copilot Instructions

Neuropsychological assessment platform for **Triune Neuropsicología**.
Stack: FastAPI + SQLAlchemy + Alembic + SQLite (backend) · React 18 + TypeScript + Vite + Tailwind (frontend).
Language: Spanish UI, English code. GDPR-compliant, clinical data (PHI), local deployment.

---

## ⚠️ Self-Maintenance Rule

**Any AI agent that makes a change to this codebase MUST update this file and `AGENTS.md` in the same commit.**

These files are the shared memory of the project across machines, AI sessions, and developers.
Stale docs are worse than no docs — the next agent will make wrong assumptions.

Update the relevant sections below to reflect every change:
- New pattern introduced → add to "Non-Negotiable Patterns"
- Security issue resolved or found → update "Known Technical Debt"
- New table or column → update "Database Conventions"
- New mandatory utility or file → update "Key Files Quick Reference" in `AGENTS.md`
- Architecture decision made → add to ADRs in `AGENTS.md`

---

## Architecture

```
backend/
  app/
    api/routes/      ← HTTP handlers (thin — validation, call service/DB, return)
    api/utils/       ← access.py (AuthZ), audit.py (logging)
    auth/            ← jwt.py, password.py, dependencies.py
    core/            ← config.py, middleware.py, limiter.py
    models/          ← SQLAlchemy ORM (one file per table)
    schemas/         ← Pydantic in/out (one file per domain)
    services/        ← business logic services + normatives calculator, PDF/Word report generation
  alembic/           ← migrations (NEVER use create_all in app code)
  tests/             ← pytest, TestClient, in-memory SQLite

frontend/
  src/
    api/             ← axios wrappers (one file per backend domain)
    components/      ← shared UI components
    pages/           ← full-page React components
    store/           ← Zustand auth store (sessionStorage)
    utils/apiError.ts ← always use extractApiError() in catch blocks
```

---

## Non-Negotiable Patterns

### 1. Schema changes → Alembic, never create_all
```bash
# After editing any model:
cd backend
alembic revision --autogenerate -m "describe_the_change"
# Review the generated file in alembic/versions/
alembic upgrade head
```
`Base.metadata.create_all()` must NEVER appear in app code. Tests may use it.

### 2. Every mutating route needs audit() BEFORE db.commit()
```python
from app.api.utils.audit import audit

# Correct — audit is in same transaction as the data change
audit(db, "patient.create", user_id=current_user.id,
      resource_type="patient", resource_id=patient.id,
      details={"age": body.age}, request=request)
db.commit()
```
Audit `details` must NEVER contain raw clinical data (PHI). Use structural metadata only:
`{"fields_changed": ["raw_data"], "test_type": "TMT-A"}` ✅
`{"before": {...raw scores...}, "after": {...}}` ❌

### 3. Every route that touches patient data needs access check
```python
from app.api.utils.access import can_access_patient, get_accessible_patient_ids

# Single patient operations:
if not can_access_patient(db, patient, current_user):
    raise HTTPException(403, "No tienes acceso a este paciente")

# List/bulk operations:
accessible = get_accessible_patient_ids(db, current_user)
sessions = db.query(TestSession).filter(TestSession.patient_id.in_(accessible))
```
Access rules: Admin → all. Neuropsicólogo → own + explicitly granted. Observador → explicitly granted (read-only).

### 4. Rate limiting on auth endpoints
```python
from app.core.limiter import limiter

@router.post("/endpoint")
@limiter.limit("10/minute")
async def handler(request: Request, ...):  # Request must be first param for slowapi
```

### 5. Frontend error handling — always use extractApiError
```typescript
import { extractApiError } from '@/utils/apiError'

} catch (err: unknown) {
  setError(extractApiError(err, 'Fallback message'))
}
```
Never cast `err` as `any` or access `.response?.data?.detail` directly. Pydantic 422 errors return `detail` as an array, not a string.

### 6. Pydantic schemas need Field constraints
```python
from pydantic import BaseModel, Field
from typing import Literal

class MyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    role: Literal["Administrador", "Neuropsicólogo", "Observador"] = "Neuropsicólogo"
    age: int = Field(ge=1, le=119)
```

### 7. All datetime columns use timezone-aware lambdas
```python
# Correct
created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
# Wrong — evaluated once at module load, also deprecated
created_at = Column(DateTime, default=datetime.utcnow)
```

### 8. Service layer — add business logic to services, not routes
```python
# backend/app/services/my_service.py
class MyService:
    def __init__(self, db: Session):
        self.db = db

    def do_thing(self, body: MyCreate, user: User, request: Request) -> MyOut:
        # access control, business logic, audit — all here
        audit(self.db, "thing.create", user_id=user.id, ..., request=request)
        self.db.commit()
        ...

# backend/app/api/routes/my_router.py — thin wrapper only
@router.post("/")
async def create_thing(body: MyCreate, request: Request, db=Depends(get_db),
                       current_user=Depends(require_role(...))):
    return MyService(db).do_thing(body, current_user, request)
```
Services in `app/services/`: `patient_service`, `user_service`, `protocol_service`,
`test_service`, `execution_plan_service`, `stats_service`.
`services/normatives/` and `services/reports/` are standalone (no class wrapper).

---

## Security Model

| Layer | Implementation |
|---|---|
| AuthN | JWT (HS256), 30-min access + 7-day refresh with JTI denylist |
| AuthZ | `require_role()` dep + `can_access_patient()` on every patient route |
| Rate limiting | slowapi: 10/min login, 20/min refresh, 5/min password change |
| Audit trail | `audit_logs` table — every mutating action, with user_id + IP |
| Security headers | `SecurityHeadersMiddleware` — OWASP headers, HSTS in production |
| Input validation | Pydantic Field constraints on all schemas |
| Password policy | min 12 chars, upper + lower + digit + symbol (see `auth/password.py`) |

**GDPR**: Patients are anonymous (age, education, laterality only — no names/DNI).
Patient deletion cascades to all related data. Audit entries are anonymised on deletion.

---

## Roles

| Role | Spanish | Permissions |
|---|---|---|
| `Administrador` | Administrador | All operations + user management |
| `Neuropsicólogo` | Neuropsicólogo | Own patients + granted access, evaluations, reports |
| `Observador` | Observador | Read-only on explicitly granted patients |

The role string literals appear in: `User.role` (SAEnum), `Literal[...]` in schemas, `require_role()` calls.
**Always use the Spanish accented strings exactly** — `"Neuropsicólogo"` not `"Neurologo"` or `"Neuropsychologist"`.

---

## Database Conventions

- Primary keys: `String` UUIDs (`str(uuid.uuid4())`)
- Foreign keys on patient/protocol: `ondelete="CASCADE"` (patient) or `"SET NULL"` (protocol)
- `used_refresh_tokens.jti` — denylist for single-use refresh tokens; safe to purge rows where `expires_at < now()`
- `encrypted_metadata` on Patient is a placeholder — currently always NULL, do not write PHI to it without implementing Fernet encryption first

---

## Testing

```bash
cd backend && source venv/bin/activate
pytest tests/ -x -q                  # full suite (~139 tests)
pytest tests/test_auth.py -v         # auth + denylist tests
```

- Tests use in-memory SQLite via `Base.metadata.create_all()` (correct for tests)
- Fixtures: `client`, `admin_headers`, `neuro_headers`, `observer_headers`, `admin_user`, `neuro_user`
- Test passwords: `"Test1234!Pass"` (meets strength policy)
- Test usernames: `"admin_test"`, `"neuro_test"`, `"observer_test"`

---

## Known Technical Debt (prioritised)

1. **~~No service layer~~** — RESOLVED: business logic extracted to `app/services/` (patient, user, protocol, test, execution_plan, stats). Route handlers are now thin wrappers.
2. **Magic role strings** — should be `StrEnum` in `app/enums.py` instead of literals.
3. **~~Inverted test pyramid~~** — RESOLVED: unit tests now cover password policy (`test_unit_password.py`), JWT type safety + JTI (`test_unit_jwt.py`), access control logic (`test_unit_access.py`), normatives calculator + all raw score extractors (`test_normatives.py`). Total: 233 tests.
4. **`ProfileUpdate` schema** in `routes/users.py` (wrong file, missing Field constraints) → move to `schemas/user.py`.
5. **`UsedRefreshToken` never purged** — add cleanup task for rows where `expires_at < now()`.
6. **Swagger UI** unconditionally enabled — disable in production (`ENVIRONMENT=production`).
7. **`python-multipart==0.0.9`** — CVE-2024-53498 ReDoS — bump to `>=0.0.12`.

---

## Running Locally

```bash
# Backend
cd backend
source venv/bin/activate
cp .env.example .env   # then fill in SECRET_KEY and ADMIN_PASSWORD
alembic upgrade head   # run migrations
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

`alembic upgrade head` is also run automatically on every server startup via `_run_migrations()` in `main.py`.
