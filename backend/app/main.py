import sys
import asyncio

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import connect_db, disconnect_db
from .core.security import hash_password
from .models.user import User, UserRole

settings = get_settings()


async def _seed_superadmin() -> None:
    """Create the super-admin account on first startup if it doesn't exist."""
    existing = await User.find_one(User.username == settings.superadmin_username)
    if not existing:
        await User(
            username=settings.superadmin_username,
            name=settings.superadmin_name,
            email=settings.superadmin_email,
            password_hash=hash_password(settings.superadmin_password),
            role=UserRole.SUPER_ADMIN,
        ).insert()
        print(f"[SEED] Super-admin '{settings.superadmin_username}' created")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────
    print("🚀 Starting PSG iTech Certificate Platform …")
    settings.ensure_storage_dirs()
    await connect_db()
    await _seed_superadmin()

    from .scheduler import start_scheduler
    start_scheduler()
    print("✓ Scheduler started")

    yield

    # ── Shutdown ─────────────────────────────────────────────────────
    from .scheduler import stop_scheduler
    stop_scheduler()
    await disconnect_db()
    print("🛑 Shutdown complete")


app = FastAPI(
    title="PSG iTech Certificate Platform",
    description="Self-hosted certificate generation and verification platform",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────
from .routers import auth, admin, clubs, events, participants, templates
from .routers import certificates, verify, register, student, dept

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(clubs.router)
app.include_router(events.router)
app.include_router(participants.router)
app.include_router(templates.router)
app.include_router(certificates.router)
app.include_router(verify.router)
app.include_router(register.router)
app.include_router(student.router)
app.include_router(dept.router)


# ── Health / Root ────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "healthy", "environment": settings.app_env}


@app.get("/")
async def root():
    return {
        "message": "PSG iTech Certificate Platform API",
        "version": "1.0.0",
        "docs": "/docs",
    }
