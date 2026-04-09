# AGENTS.md — Nóos Platform Context

> This file provides context for AI coding agents (Claude, Cursor, Codex, etc.).
> The canonical AI instructions live in `.github/copilot-instructions.md`.
> This file adds agent-specific workflow guidance.

---

## ⚠️ Meta-Rule: Keep This File Current

**Whenever you make any change to the codebase, you MUST update both:**
- `AGENTS.md` (this file)
- `.github/copilot-instructions.md`

This is not optional. These files are the memory of the project across machines and AI sessions.
A change committed without updating these files leaves the next agent with stale context.

**What to update for each type of change:**

| Change type | What to update |
|---|---|
| New endpoint or route | Key Files table, mandatory patterns if new pattern introduced |
| New model / migration | DB Conventions section |
| New mandatory pattern or utility | "Mandatory Rules" + NEVER/ALWAYS lists |
| Security fix | Current Security Posture table (mark resolved, add new items) |
| New tech debt identified | Known Technical Debt section in `copilot-instructions.md` |
| Architecture decision | ADRs section |
| New dependency | Stack line at top |
| File moved or renamed | Key Files Quick Reference table |

After updating, commit the docs in the **same commit** as the code change.

---

## What This Codebase Is

**Nóos** is a neuropsychological assessment platform for Triune Neuropsicología (Spain).
It manages anonymous patients, evaluation protocols, and NEURONORMA normative scoring.
Deployed locally at clinics — GDPR applies, PHI rules are strict, data never leaves the machine.

**Backend**: FastAPI · SQLAlchemy 2 · Alembic · SQLite · bcrypt · PyJWT · slowapi
**Frontend**: React 18 · TypeScript · Vite · Tailwind CSS · Zustand · Axios · React Router

---

## Before You Write Any Code

1. **Read `.github/copilot-instructions.md`** — it contains all mandatory patterns.
2. **Run the test suite** to establish baseline: `cd backend && pytest tests/ -x -q`
3. **Check for pending migrations**: `cd backend && alembic current` should show `(head)`.

---

## Mandatory Rules for Agents

### NEVER do these:
- ❌ Use `Base.metadata.create_all()` in app code (tests only)
- ❌ Write PHI (raw clinical scores) into `audit_logs.details`
- ❌ Access patient data without calling `can_access_patient()` first
- ❌ Add a mutating endpoint without calling `audit()` before `db.commit()`
- ❌ Use `datetime.utcnow` — use `lambda: datetime.now(timezone.utc)`
- ❌ Cast `err` as `any` in TypeScript — use `extractApiError()` from `@/utils/apiError`
- ❌ Store role strings as plain literals — use the exact Spanish strings from the enum

### ALWAYS do these:
- ✅ Add an Alembic migration for every model change
- ✅ Add `Field(min_length=..., max_length=...)` to every new Pydantic schema field
- ✅ Add `render_as_batch=True` to any new Alembic migration context (SQLite requirement)
- ✅ Add `request: Request` as a parameter to any new mutating route
- ✅ Run `pytest tests/ -x -q` after every change and confirm all tests pass

---

## How to Add a New Feature (Checklist)

### New API endpoint
1. Add route to appropriate file in `backend/app/api/routes/`
2. Add Pydantic schemas to `backend/app/schemas/`
3. If touching patient data: add `can_access_patient()` check
4. Add `audit()` call before `db.commit()` on mutating operations
5. Add `@limiter.limit()` if the endpoint is a potential DoS/brute-force target
6. Add tests in `backend/tests/`

### New database column or table
1. Edit the SQLAlchemy model in `backend/app/models/`
2. Run: `cd backend && alembic revision --autogenerate -m "description"`
3. Review the generated migration file in `alembic/versions/`
4. Run: `alembic upgrade head`
5. Commit both the model change and the migration file together

### New frontend page
1. Create `frontend/src/pages/MyPage.tsx`
2. Add route in `frontend/src/App.tsx`
3. Use `@/api/client.ts` (the configured Axios instance) for all API calls
4. Always wrap API calls in try/catch using `extractApiError()`
5. Never access `localStorage` for auth state — use `useAuthStore` (Zustand, sessionStorage)

---

## Key Files Quick Reference

| Purpose | File |
|---|---|
| App entrypoint + startup | `backend/app/main.py` |
| Settings / .env | `backend/app/core/config.py`, `backend/.env` |
| Auth JWT logic | `backend/app/auth/jwt.py` |
| Patient access control | `backend/app/api/utils/access.py` |
| Audit logging | `backend/app/api/utils/audit.py` |
| Security headers | `backend/app/core/middleware.py` |
| Rate limiter singleton | `backend/app/core/limiter.py` |
| Alembic config | `backend/alembic.ini`, `backend/alembic/env.py` |
| Auth store (frontend) | `frontend/src/store/auth.ts` |
| API error handling | `frontend/src/utils/apiError.ts` |
| Axios client + refresh | `frontend/src/api/client.ts` |

---

## Current Security Posture

All P0 and P1 security audit findings have been resolved. Remaining known issues:

| ID | Priority | Issue |
|---|---|---|
| P2-2 | Medium | `PATCH /users/me` missing rate limit and audit on password change |
| P2-3 | Medium | `ProfileUpdate` schema missing Field constraints (in wrong file) |
| P2-4 | Medium | `LoginRequest` missing `max_length` (bcrypt DoS vector) |
| P2-5 | Medium | Swagger UI enabled in all environments |
| P2-7 | Medium | `python-multipart==0.0.9` — CVE-2024-53498 |
| P2-8 | Medium | `encrypted_metadata` column never encrypted |
| P2-9 | Medium | No `Cache-Control: no-store` on PHI API responses |
| P2-10 | Medium | Patient deletion leaves PHI in audit logs |
| P2-11 | Medium | No GDPR Art.20 data portability export endpoint |

---

## Architecture Decisions (ADRs)

### Why SQLite
Single-file database, zero infrastructure, portable backup. Sufficient for single-practitioner use.
SQLAlchemy ORM means migration to PostgreSQL requires only a `DATABASE_URL` change.

### Why no service layer (yet)
Business logic currently lives in route handlers. This is acknowledged technical debt.
The normatives calculator in `services/normatives/` is the one existing service.
New features should extract business logic into `app/services/` — do not add more logic to route files.

### Why anonymous patients
GDPR data minimisation. Patients are identified by UUID only. No names, no DNI, no contact info.
Demographics stored: age, education years, laterality, optional 1-10 char initials.

### Why sessionStorage for JWT
XSS mitigation — access tokens are not persisted across browser sessions.
Refresh tokens are rotated on every use (single-use JTI denylist in `used_refresh_tokens` table).

### Why Alembic over create_all
`create_all()` is a one-way door — it creates tables but never alters them.
Alembic generates versioned, reversible migrations. `render_as_batch=True` enables full
ALTER TABLE support on SQLite via copy-and-rename strategy.
