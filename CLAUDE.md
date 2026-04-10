# CLAUDE.md — Nóos Platform

> Read by Claude Code automatically on session start.

## 🔴 START HERE

**Read [`BUSINESS_LOGIC.md`](./BUSINESS_LOGIC.md) before making any change.**

It is the single source of truth for all business logic, UX flows, roles, permissions,
data models, scoring rules, and security policy.

**Update it in the same commit whenever you change any of those things.**

---

## Project summary

Nóos is a neuropsychological assessment platform (FastAPI + React + PostgreSQL).
Full architecture and patterns are in `.github/copilot-instructions.md` and `AGENTS.md`.

Key rules:
- Schema changes → Alembic migrations only (`alembic revision --autogenerate`)
- Every mutating route → `audit()` before `db.commit()`
- Every patient route → `can_access_patient()` access check
- Errors in frontend → always use `extractApiError()` from `@/utils/apiError`
- Roles: `"Administrador"` / `"Neuropsicólogo"` / `"Observador"` (exact Spanish strings)
- Patients are anonymous — never store names, DNI, email, phone (GDPR)
