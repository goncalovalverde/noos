# Nóos — Business Logic & UX Flow Reference

> **⚠️ LIVING DOCUMENT — AGENTS MUST KEEP THIS UP TO DATE**
>
> This file is the canonical reference for all business logic, UX flows, and rules in the Nóos platform.
> **Whenever you change any business logic, access rules, UX flows, validation rules, scoring logic,
> or data models, update the relevant section of this document in the same commit.**
> All future agents working on this codebase must read this file first and update it when making changes.

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Tech Stack](#2-tech-stack)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Authentication Flow](#4-authentication-flow)
5. [Patient Management](#5-patient-management)
6. [Protocol Management](#6-protocol-management)
7. [Evaluation Flow](#7-evaluation-flow)
8. [Neuropsychological Tests](#8-neuropsychological-tests)
9. [Normative Score Calculation](#9-normative-score-calculation)
10. [Dashboard & Statistics](#10-dashboard--statistics)
11. [Reports (PDF / Word)](#11-reports-pdf--word)
12. [Settings & Administration](#12-settings--administration)
13. [Security Rules](#13-security-rules)
14. [Frontend Routes & Pages](#14-frontend-routes--pages)
15. [Data Models Quick Reference](#15-data-models-quick-reference)
16. [Audit Log Events](#16-audit-log-events)

---

## 1. Application Overview

**Nóos** is a neuropsychological assessment platform for clinical neuropsychologists.

**Core workflow:**
1. Admin creates user accounts for neuropsychologists
2. Neuropsychologist registers an anonymous patient
3. Neuropsychologist selects a protocol (test battery) for that patient
4. An evaluation session is configured (live or paper entry mode)
5. Each test in the protocol is executed, raw scores recorded
6. Scores are automatically converted to NEURONORMA normative values (PE, percentile, classification)
7. Results visualised on the patient hub; PDF/Word reports generated

**Deployment:** Docker (PostgreSQL in production, SQLite for local dev). FastAPI backend + React frontend behind nginx.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python 3.12), SQLAlchemy ORM, Alembic migrations |
| Database | PostgreSQL (prod) / SQLite (dev + tests) |
| Auth | JWT (PyJWT) — HS256, access + refresh tokens |
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, Zustand, Recharts |
| Container | Docker Compose; nginx serves frontend + proxies `/api/*` to backend |
| Tests | pytest (backend), Vitest + MSW (frontend) |

---

## 3. User Roles & Permissions

Three roles defined in `backend/app/enums.py`:

| Role | Value in DB | Description |
|---|---|---|
| `UserRole.ADMIN` | `"Administrador"` | Full system access |
| `UserRole.NEURO` | `"Neuropsicólogo"` | Clinical work (patients, evaluations) |
| `UserRole.OBSERVER` | `"Observador"` | Read-only access to granted patients |

### Permission Matrix

| Action | Administrador | Neuropsicólogo | Observador |
|---|---|---|---|
| Access `/settings` | ✅ | ❌ | ❌ |
| Create/edit/delete users | ✅ | ❌ | ❌ |
| Reset any user's password | ✅ | ❌ | ❌ |
| View all patients | ✅ | ❌ (own + granted) | ❌ (granted only) |
| Create patients | ✅ | ✅ | ❌ |
| Edit patient data | ✅ | ✅ (accessible) | ❌ |
| Delete patient | ✅ | ✅ (own patients only) | ❌ |
| Manage patient access grants | ✅ | ✅ (own patients only) | ❌ |
| Create/edit/delete protocols | ✅ | ✅ if `can_manage_protocols=true` | ❌ |
| View protocols | ✅ | ✅ | ✅ |
| Start evaluations | ✅ | ✅ | ❌ |
| View evaluation results | ✅ | ✅ (accessible patients) | ✅ (granted patients) |
| Generate reports | ✅ | ✅ (accessible patients) | ✅ (granted patients) |
| Change own password | ✅ | ✅ | ✅ |

### `can_manage_protocols` flag
- Additional boolean on `Neuropsicólogo` users (Admins always have it)
- Allows protocol creation/editing without needing the Admin role
- Set by Admin in user management

### Backend enforcement
- `require_role(UserRole.ADMIN)` — admin-only endpoints
- `get_current_active_user` — any authenticated active user
- `require_protocol_management()` — Admin OR Neuro with `can_manage_protocols=True`
- Patient access: `can_access_patient()` util checks ownership + `PatientAccess` grants

### Frontend enforcement
- `<ProtectedRoute allowedRoles={['Administrador']}>` on `/settings`
- Conditional rendering of buttons (e.g. "Nuevo paciente" hidden for Observador)

---

## 4. Authentication Flow

### Login
- `POST /api/auth/login` (rate limited: 10/minute per IP)
- Request: `{username, password}`
- Response: `{access_token, refresh_token, user}`
- On success: records `last_login`, creates audit event `auth.login`
- On failure: 401 (intentionally vague — "Usuario o contraseña incorrectos")

### JWT Tokens
- **Access token**: HS256, expires in 30 minutes (`ACCESS_TOKEN_EXPIRE_MINUTES`)
  - Payload: `{sub: user_id, role, type: "access", exp}`
- **Refresh token**: HS256, expires in 7 days (`REFRESH_TOKEN_EXPIRE_DAYS`)
  - Payload: `{sub: user_id, role, type: "refresh", jti: uuid, exp}`
  - JTI (JWT ID) is unique per token — used for replay prevention

### Token Refresh (`POST /api/auth/refresh`)
- Rate limited: 20/minute
- Single-use: JTI stored in `used_refresh_tokens` table on first use
- Any replay → immediate 401
- Opportunistic cleanup of expired JTIs in the same transaction
- Returns new access + refresh token pair

### Frontend token storage
- Stored in `sessionStorage` (not localStorage) — clears on tab close, never on disk
- Managed by Zustand `useAuthStore` with `persist` middleware using sessionStorage
- Axios interceptor auto-attaches `Authorization: Bearer <token>` header
- On 401 response: attempts token refresh; if refresh fails → logout

### Logout (`POST /api/auth/logout`)
- Clears session state on frontend
- Audit event `auth.logout` logged

### Password change (own account)
- `POST /api/auth/change-password` (rate limited: 5/minute)
- Requires `current_password` + `new_password`
- Strength validation enforced (see §13)

---

## 5. Patient Management

### Patient data (GDPR-first design)
Patients are **anonymous by design**. No names, DNI, email, address, or phone stored.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `age` | Integer | Age in years |
| `education_years` | Integer | Years of formal education |
| `laterality` | String | `diestro` / `zurdo` / `ambidextro` |
| `initials` | String (10) | Optional initials (e.g. "JMR") |
| `created_by_id` | FK → users | Owner (creator) of the patient |
| `created_at` | DateTime | Creation timestamp |

**Display ID** is computed: `{initials} ({last4 of UUID})` or `PKT-{last4}` if no initials.

### Patient ownership
- Created by a `Neuropsicólogo` or `Administrador`
- Creator is automatically granted access (`PatientAccess` record created at same time)
- `created_by_id` is the authoritative "owner"

### Patient access model (`PatientAccess`)
Separate from ownership — allows sharing:

| Field | Description |
|---|---|
| `patient_id` + `user_id` | Composite primary key |
| `granted_by_id` | Who granted the access |
| `granted_at` | When granted |

- Access can be granted to any user by the patient owner or an Admin
- Access can be revoked by owner or Admin
- The creator's own access grant **cannot be revoked** (returns 400)

### Who can see a patient
`can_access_patient()` logic:
1. **Admin** → always yes
2. Patient has no `created_by_id` (legacy/migrated) → yes (open access)
3. Current user is `created_by_id` → yes
4. `PatientAccess` record exists for this user → yes

`list_patients()` for non-admins returns: owned + granted + legacy (no owner).

### Delete patient
- Only the patient's owner or an Admin can delete
- Non-owner with access grant → 403
- Cascade deletes: `TestSession`, `ExecutionPlan`, `PatientAccess`, `PatientProtocol`

### Owner deletion / patient reassignment
When an Admin deletes a user who owns patients:
1. Frontend calls `GET /api/users/{id}/patients-count` to check
2. If count > 0 → reassignment modal shown (cannot skip)
3. Admin selects a new owner OR leaves blank (defaults to `admin` user)
4. `DELETE /api/users/{id}?reassign_to={new_owner_id}` called
5. All owned patients' `created_by_id` updated before user deletion

---

## 6. Protocol Management

### What is a Protocol?
A reusable template defining a battery of neuropsychological tests.

| Field | Description |
|---|---|
| `name` | Unique name |
| `description` | Optional description |
| `category` | Optional category tag |
| `is_public` | Visible to all users (default: true) |
| `allow_customization` | Whether clinician can modify tests before running (default: true) |
| `created_by_id` | Creator (SET NULL on user delete) |
| `tests` | Ordered list of `ProtocolTest` records |

### ProtocolTest
Each entry in a protocol:
- `test_type`: string matching known test keys (e.g. `"TMT-A"`, `"TAVEC"`)
- `order`: integer for sequencing
- `default_notes`: pre-filled clinical notes template

### PatientProtocol assignment
When a protocol is assigned to a patient:
- Status: `pending` → `in_progress` → `completed`
- This is separate from `ExecutionPlan` — the assignment is the intention, the plan is the execution

### Who can manage protocols
- Admin: always
- Neuropsicólogo with `can_manage_protocols=True`
- Observador: never

---

## 7. Evaluation Flow

### Overview
```
Patient selected
    ↓
EvaluationSetup: choose protocol + mode (live/paper)
    ↓
ExecutionPlan created (status: draft)
    ↓
EvaluationSession: execute tests one by one
    ↓
    For each test: enter raw scores → NEURONORMA calculation → TestSession saved
    ↓
    Tests can be skipped (marked skip=true) or flagged for later (repeat_later=true)
    ↓
ExecutionPlan status → completed
    ↓
EvaluationSummary: review all results
    ↓
Generate PDF or Word report (optional)
```

### ExecutionPlan
A concrete instance of a protocol being applied to a patient.

| Field | Values | Description |
|---|---|---|
| `status` | `draft` / `active` / `completed` / `abandoned` | Current state |
| `mode` | `live` / `paper` | Live = real-time; Paper = entering results from paper test |
| `test_customizations` | JSON array | Per-test overrides of the protocol template |
| `is_saved_variant` | Boolean | Whether this is a saved named variant |
| `variant_name` | String | Name of the saved variant |
| `performed_at` | DateTime | When the evaluation was performed |

### Test customisation per plan
Each entry in `test_customizations`:
```json
{
  "test_type": "TMT-A",
  "order": 1,
  "skip": false,
  "added": false,
  "repeat_later": false,
  "notes": ""
}
```
- `skip=true`: test excluded from this run
- `added=true`: test added beyond the base protocol
- `repeat_later=true`: test deferred to a subsequent session
- `order`: determines execution sequence

### TestSession
Each completed test produces one `TestSession` record:

| Field | Description |
|---|---|
| `patient_id` | FK to patient |
| `protocol_id` | FK to protocol (nullable) |
| `execution_plan_id` | FK to plan (nullable) |
| `test_type` | String key (e.g. `"TMT-A"`) |
| `date` | When the test was performed |
| `raw_data` | JSON: test-specific measurements |
| `calculated_scores` | JSON: `{puntuacion_escalar, percentil, z_score, clasificacion, norma_aplicada}` |
| `qualitative_data` | JSON: `{observaciones, checklist_items}` |

### Modes
- **Live**: evaluation performed in real-time; `performed_at` set to now at plan creation
- **Paper**: clinician enters scores from a paper test; `performed_at` set manually

### Incomplete evaluations
Plans with `status=draft` or `status=active` appear on the `/evaluaciones/incompletas` page.
Non-admins see only their accessible patients' plans.

---

## 8. Neuropsychological Tests

All known test types and their raw data structures:

| Test Key | Raw Data Fields | Score Extraction |
|---|---|---|
| `TMT-A` | `tiempo_segundos`, `errores` | `tiempo_segundos` (lower = better) |
| `TMT-B` | `tiempo_segundos`, `errores` | `tiempo_segundos` (lower = better) |
| `TAVEC` | `ensayo_1`…`ensayo_5`, `lista_b`, `recuerdo_inmediato`, `recuerdo_demorado`, `reconocimiento` | sum of `ensayo_1`…`ensayo_5` |
| `Fluidez-FAS` | `letra_f`, `letra_a`, `letra_s` | `letra_f + letra_a + letra_s` |
| `Fluidez-Semantica` | `animales` | `animales` |
| `Rey-Copia` | `puntuacion_bruta`, `tiempo` | `puntuacion_bruta` |
| `Rey-Memoria` | `puntuacion_bruta`, `tiempo_demora` | `puntuacion_bruta` |
| `Stroop` | `palabras`, `colores`, `interferencia` | Golden interference index: `PC_obs - (P×C)/(P+C)` |
| `Torre-de-Londres` | `movement_counts[]`, `time_seconds` | composite via `TowerOfLondonCalculator` |
| `Dígitos` | `digitos_directos`, `digitos_inversos`, `secuencia_letras_numeros` | sum of all three |
| `WAIS-IV` | `CI_total` (+ subtest scores) | `CI_total` |
| `BRIEF-A` | multiple subscale scores | sum of all values |
| `DIVA-5` | `inatención_actual`, `hiperactividad_actual` | sum |
| `Test-d2-R` | `indice_concentracion` | `indice_concentracion` |
| `FDT` | `elegir_tiempo`, `alternar_tiempo` | sum |
| `BADS-Zoo` | `puntuacion_perfil` | `puntuacion_perfil` |
| `BADS-Llave` | `puntuacion_estrategia` | `puntuacion_estrategia` |
| `FCSRT` | `total_inmediato` | `total_inmediato` |
| `Toulouse-Pieron` | `productividad_neta` | `productividad_neta` |
| `Perfil-Sensorial` | multiple subscales | sum of all values |

**Frontend form components** (`frontend/src/components/evaluation/forms/`):
- `TmtForm` → TMT-A, TMT-B
- `TavecForm` → TAVEC
- `FluidezFasForm` → Fluidez-FAS
- `FluidezSemanticaForm` → Fluidez-Semantica
- `ReyForm` → Rey-Copia, Rey-Memoria
- `StroopForm` → Stroop
- `TorreForm` → Torre-de-Londres
- `DigitosForm` → Dígitos
- `WaisSubtestForm` → WAIS-IV
- `GenericForm` → all other tests (single `puntuacion_bruta` field)

---

## 9. Normative Score Calculation

All scoring via `backend/app/services/normatives/calculator.py`.

### NEURONORMA tables
JSON tables in `backend/app/services/normatives/tables/`:
- `tmt_a.json`, `tmt_b.json`, `fluidez_fas.json`, `fluidez_semantica.json`
- `tavec.json`, `rey_copia.json`, `rey_memoria.json`

Table structure: `age_ranges → education_ranges → conversion_table {raw_score: {pe, percentil}}`

### Lookup procedure
1. Find matching age range (`age_min ≤ age ≤ age_max`); fallback to first range
2. Find matching education range; fallback to first range
3. Look up `raw_score` in `conversion_table`; if not exact → linear interpolation

### WAIS-IV special case
Handled by separate logic; normative source is `"WAIS-IV"`.

### Simulated fallback
Tests without a validated normative table return:
```json
{"puntuacion_escalar": null, "percentil": null, "z_score": null,
 "clasificacion": "Sin norma validada", "norma_aplicada": {"fuente": "Sin tabla normativa"}}
```

### Score output structure
```json
{
  "puntuacion_escalar": 14,
  "percentil": 91.0,
  "z_score": 1.34,
  "clasificacion": "Superior",
  "norma_aplicada": {
    "fuente": "NEURONORMA",
    "test": "TMT-A",
    "rango_edad": "50-64",
    "rango_educacion": "8-12"
  }
}
```

### Classification thresholds
| Percentile | Classification |
|---|---|
| ≥ 75 | **Superior** |
| 25 – 74 | **Normal** |
| 10 – 24 | **Limítrofe** |
| < 10 | **Deficitario** |

### PE ↔ Percentile mapping
Fixed lookup table (PE 1–19 → percentile 0.1–99.9). Z-score computed from percentile via `scipy.stats.norm.ppf`.

---

## 10. Dashboard & Statistics

Page: `/dashboard` — available to all authenticated users.

### Overview cards (`GET /api/stats/overview`)
- **Total patients**: accessible patients for user (all for admin)
- **Tests this week**: test sessions in last 7 days (accessible patients)
- **Active protocols**: total protocol count (all users see same)
- **Completed this month**: execution plans completed in last 30 days

### Recent plans (`GET /api/stats/recent-plans`)
Last 10 execution plans (by `updated_at`), filtered to accessible patients.

### Incomplete evaluations (`GET /api/stats/incomplete-plans`)
Plans with `status=draft` or `status=active`. Returns count of unique patients affected + list.

### Classification distribution (`GET /api/stats/classification-distribution`)
Aggregates `clasificacion` field from all `TestSession.calculated_scores` JSON across accessible patients.
Returns count per category: `Superior / Normal / Limítrofe / Deficitario`.

---

## 11. Reports (PDF / Word)

Endpoints in `/api/reports/`.

- Generated from `ExecutionPlan` + its `TestSession` results
- Reports saved to `REPORTS_DIR` (volume-mounted `/data/reports` in production)
- Access controlled: must have access to the patient

### Content
- Patient anonymous demographics (age, education, laterality, display ID)
- Protocol name and evaluation date
- Per-test results: test name, raw data, PE, percentile, classification
- Classification colour coding: green (Superior), blue (Normal), yellow (Limítrofe), red (Deficitario)
- Clinical observations from `qualitative_data`

---

## 12. Settings & Administration

Page: `/settings` — **Admin only**.

### User management
- List all users (ordered by `created_at`)
- Create user: username (unique), password (strength validated), email, full_name, role, `can_manage_protocols`
- Edit user: email, full_name, role, `can_manage_protocols`, `is_active`
- Cannot edit username after creation
- Delete user: inline confirmation (no owned patients) OR reassignment modal (has owned patients)
- Reset password: separate modal, no current password required (Admin privilege)
- Cannot delete own account (returns 400)

### Patient reassignment on user deletion
See §5 — "Owner deletion / patient reassignment".

---

## 13. Security Rules

### Password requirements
Minimum 12 characters, must contain:
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character: `!@#$%^&*()_+-=[]{}|;':",./<>?`

Enforced on: create user, change password (self), admin reset password.

### Rate limiting (slowapi, per IP)
| Endpoint | Limit |
|---|---|
| `POST /api/auth/login` | 10/minute |
| `POST /api/auth/refresh` | 20/minute |
| `POST /api/auth/change-password` | 5/minute |
| `PATCH /api/users/me` | 5/minute |

### JWT security
- Access token: 30-minute expiry (configurable)
- Refresh token: 7-day expiry, single-use (JTI denylist in `used_refresh_tokens`)
- Tokens stored in `sessionStorage` only (never localStorage or cookies)
- Expired JTIs pruned opportunistically on refresh calls

### CORS
Allowed origins: `http://localhost:5173`, `http://localhost:3000` (development).
Production: nginx handles CORS via proxy — no cross-origin requests needed.

### Audit logging
All state-changing operations create an `AuditLog` record (same transaction as the change).
See §16 for full list of audit events.

---

## 14. Frontend Routes & Pages

| Route | Component | Access | Description |
|---|---|---|---|
| `/login` | `Login` | Public | Username + password form |
| `/dashboard` | `Dashboard` | All auth | Overview cards + recent plans + classification chart |
| `/patients` | `PatientList` | All auth | Paginated patient list; "Nuevo paciente" for Neuro/Admin |
| `/patients/:id` | `PatientHub` | Accessible | Patient details, evaluation history, access management |
| `/patients/:id/evaluate` | `EvaluationSetup` | Neuro/Admin | Protocol selection, mode choice, test customisation |
| `/patients/:id/evaluate/:planId` | `EvaluationSession` | Neuro/Admin | Step-by-step test execution |
| `/patients/:id/evaluate/:planId/summary` | `EvaluationSummary` | Accessible | Results review + report download |
| `/evaluaciones/incompletas` | `IncompleteEvaluations` | All auth | All draft/active plans for accessible patients |
| `/protocols` | `ProtocolLibrary` | All auth | List protocols; create/edit for permitted users |
| `/profile` | `Profile` | All auth | Change own email and password |
| `/settings` | `Settings` | Admin only | User management |
| `*` | — | — | Redirects to `/dashboard` |

---

## 15. Data Models Quick Reference

```
User
  id, username, email, full_name, hashed_password
  role: Administrador | Neuropsicólogo | Observador
  can_manage_protocols, is_active, created_at, last_login

Patient
  id, age, education_years, laterality, initials
  created_by_id → User (SET NULL on delete)
  display_id: computed "{initials} ({uuid_last4})"

PatientAccess
  patient_id + user_id (composite PK)
  granted_by_id → User (SET NULL on delete)

Protocol
  id, name, description, category
  is_public, allow_customization
  created_by_id → User (SET NULL on delete)
  tests → [ProtocolTest]

ProtocolTest
  protocol_id, test_type, order, default_notes

PatientProtocol
  patient_id, protocol_id, status (pending|in_progress|completed)

ExecutionPlan
  id, patient_id, protocol_id
  mode (live|paper), status (draft|active|completed|abandoned)
  test_customizations: JSON [{test_type, order, skip, added, repeat_later, notes}]
  is_saved_variant, variant_name, performed_at

TestSession
  id, patient_id, protocol_id, execution_plan_id
  test_type, date
  raw_data: JSON (test-specific)
  calculated_scores: JSON {puntuacion_escalar, percentil, z_score, clasificacion, norma_aplicada}
  qualitative_data: JSON {observaciones, checklist_items}

AuditLog
  id, user_id, action, resource_type, resource_id
  details: JSON, ip_address, created_at

UsedRefreshToken
  jti (PK), expires_at  (JTI denylist for token replay prevention)
```

---

## 16. Audit Log Events

All logged via `audit()` in `backend/app/api/utils/audit.py`:

| Action | Triggered by |
|---|---|
| `auth.login` | Successful login |
| `auth.logout` | Logout |
| `auth.password_change` | User changes own password |
| `user.create` | Admin creates a user |
| `user.update` | Admin updates a user |
| `user.delete` | Admin deletes a user (includes `patients_reassigned` count) |
| `user.password_reset_by_admin` | Admin resets a user's password |
| `user.profile_update` | User updates own profile |
| `patient.create` | Patient registered |
| `patient.update` | Patient data edited |
| `patient.delete` | Patient deleted |
| `patient.access.grant` | Access granted to another user |
| `patient.access.revoke` | Access revoked from a user |
| `execution_plan.create` | Evaluation plan created |

---

*Last updated: 2026-04-10 — reflects codebase state at commit `b9b6e1a`*
