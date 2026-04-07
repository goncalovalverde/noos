from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.base import Base, engine, SessionLocal
from app.api.routes import auth as auth_router
from app.api.routes import users as users_router
from app.api.routes import patients as patients_router
from app.api.routes import protocols as protocols_router
from app.api.routes import tests as tests_router
from app.api.routes import execution_plans as execution_plans_router
from app.api.routes import reports as reports_router

# Import models so SQLAlchemy registers them before create_all
from app.models import User, AuditLog, Patient, TestSession, Protocol, ProtocolTest, PatientProtocol, ExecutionPlan  # noqa: F401

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

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _seed_admin()
    yield

app = FastAPI(
    title="Nóos API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(patients_router.router)
app.include_router(protocols_router.router)
app.include_router(tests_router.router)
app.include_router(execution_plans_router.router)
app.include_router(reports_router.router)

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}
