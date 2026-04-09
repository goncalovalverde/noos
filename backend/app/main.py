from contextlib import asynccontextmanager
import os
import stat
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from alembic.config import Config as AlembicConfig
from alembic import command as alembic_command
from app.core.limiter import limiter
from app.core.config import settings
from app.core.middleware import SecurityHeadersMiddleware
from app.db.base import SessionLocal
from app.api.routes import auth as auth_router
from app.api.routes import users as users_router
from app.api.routes import patients as patients_router
from app.api.routes import protocols as protocols_router
from app.api.routes import tests as tests_router
from app.api.routes import execution_plans as execution_plans_router
from app.api.routes import reports as reports_router
from app.api.routes import stats as stats_router

# Models must be imported so Alembic's env.py can see them via Base.metadata.
# They are also imported by alembic/env.py directly; these imports ensure the
# app module graph is consistent at runtime.
from app.models import User, AuditLog, Patient, PatientAccess, TestSession, Protocol, ProtocolTest, PatientProtocol, ExecutionPlan, UsedRefreshToken  # noqa: F401

def _run_migrations():
    """Apply any pending Alembic migrations on startup.

    This replaces the previous `Base.metadata.create_all()` call. Unlike
    create_all(), Alembic will correctly handle ALTER TABLE, column renames,
    index changes, and other schema modifications across deployments.

    The alembic.ini file is resolved relative to this file's location so the
    app works regardless of the working directory when uvicorn is launched.
    """
    alembic_cfg = AlembicConfig(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    alembic_command.upgrade(alembic_cfg, "head")

def _seed_admin():
    """Create initial Administrador if none exists."""
    if not settings.ADMIN_PASSWORD:
        print("⚠️  WARNING: ADMIN_PASSWORD not set. Skipping admin seed.")
        return
    db = SessionLocal()
    try:
        from app.models.user import User
        from app.auth.password import hash_password, validate_password_strength
        if db.query(User).filter(User.role == "Administrador").count() == 0:
            if not validate_password_strength(settings.ADMIN_PASSWORD):
                raise ValueError(
                    "ADMIN_PASSWORD no cumple los requisitos de seguridad "
                    "(mín. 12 caracteres, mayúsculas, minúsculas, números y símbolo especial)"
                )
            admin = User(
                username="admin",
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                full_name="Administrador",
                role="Administrador",
                can_manage_protocols=True,
            )
            db.add(admin)
            db.commit()
            print("✅ Admin inicial creado (usuario: admin)")
    finally:
        db.close()

def _secure_db_files():
    """Restrict SQLite DB file permissions to owner-only (chmod 600)."""
    db_url = settings.DATABASE_URL
    # Extract path from sqlite:///./noos.db or sqlite:////absolute/path
    if db_url.startswith("sqlite:///"):
        db_path = Path(db_url.replace("sqlite:///", ""))
        if db_path.exists():
            current = stat.S_IMODE(os.stat(db_path).st_mode)
            if current & (stat.S_IRGRP | stat.S_IWGRP | stat.S_IROTH | stat.S_IWOTH):
                os.chmod(db_path, stat.S_IRUSR | stat.S_IWUSR)
                print(f"🔒 DB file permissions restricted to 600: {db_path}")

def _validate_secrets():
    """Refuse to start in production with default/weak secret key."""
    weak_keys = {"changeme", "changeme-use-openssl-rand-hex-32", "dev-secret-key-change-in-production-32chars"}
    if settings.ENVIRONMENT == "production" and settings.SECRET_KEY in weak_keys:
        raise RuntimeError(
            "SECRET_KEY must be changed for production. "
            "Generate one with: openssl rand -hex 32"
        )

@asynccontextmanager
async def lifespan(app: FastAPI):
    _validate_secrets()
    _secure_db_files()
    _run_migrations()
    _seed_admin()
    yield

app = FastAPI(
    title="Nóos API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# Rate limiter — keyed by client IP. Login endpoint is limited to 10/minute.
# The limiter singleton is defined in app/core/limiter.py and shared with route modules.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security headers on every response (added after CORS middleware).
app.add_middleware(SecurityHeadersMiddleware)

app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(patients_router.router)
app.include_router(protocols_router.router)
app.include_router(tests_router.router)
app.include_router(execution_plans_router.router)
app.include_router(reports_router.router)
app.include_router(stats_router.router)

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}
