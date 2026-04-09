import sys
import asyncio

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .config import get_settings
from .database import connect_db, disconnect_db
from .core.security import hash_password
from .models.user import User, UserRole

settings = get_settings()

# ── Rate limiter ─────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


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


async def _seed_image_templates() -> None:
    """Seed ImageTemplate documents from PNG files in static/certificate_templates/.

    Scans for *.png files and upserts one ImageTemplate document per file,
    using the filename as the unique key. Display name defaults to the
    filename stem, title-cased (e.g. "template_01" → "Template 01").
    """
    from pathlib import Path
    from .models.image_template import ImageTemplate

    cert_templates_dir = Path(__file__).parent / "static" / "certificate_templates"
    if not cert_templates_dir.exists():
        print("[SEED] certificate_templates/ directory not found — skipping image template seeding")
        return

    png_files = list(cert_templates_dir.glob("*.png"))
    if not png_files:
        print("[SEED] No PNG files found in certificate_templates/ — skipping image template seeding")
        return

    created = 0
    for png_path in sorted(png_files):
        filename = png_path.name
        existing = await ImageTemplate.find_one(ImageTemplate.filename == filename)
        if existing:
            continue
        display_name = png_path.stem.replace("_", " ").title()
        preview_url = f"/static/certificate_templates/{filename}"
        await ImageTemplate(
            filename=filename,
            display_name=display_name,
            preview_url=preview_url,
        ).insert()
        created += 1
        print(f"[SEED] Image template registered: {filename} → '{display_name}'")

    if created == 0:
        print("[SEED] All image templates already registered")
    else:
        print(f"[SEED] Image templates: {created} registered")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────
    print("[START] Starting PSG iTech Certificate Platform...")
    settings.ensure_storage_dirs()
    await connect_db()

    # Mount storage after startup guarantees storage dirs exist.
    from fastapi.staticfiles import StaticFiles as _SF
    app.mount("/storage", _SF(directory=str(settings.storage_root)), name="storage")

    await _seed_superadmin()
    await _seed_image_templates()

    from .scheduler import start_scheduler
    start_scheduler()
    print("[OK] Scheduler started")

    yield

    # ── Shutdown ─────────────────────────────────────────────────────
    from .scheduler import stop_scheduler
    stop_scheduler()
    await disconnect_db()
    print("[STOP] Shutdown complete")


app = FastAPI(
    title="PSG iTech Certificate Platform",
    description="Self-hosted certificate generation and verification platform",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Rate limiting ────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ─────────────────────────────────────────────────────────────────
_ALLOWED_ORIGINS = list({
    settings.frontend_url,       # from .env / config
    "http://localhost:5173",      # Vite default
    "http://localhost:5174",      # Alternative Vite port
    "http://localhost:3000",      # CRA fallback
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
})
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global exception handler — ensures CORS headers survive 500 errors ────
@app.exception_handler(Exception)
async def _global_exception_handler(request: Request, exc: Exception):
    """Return a JSON 500 with CORS headers so the browser isn't blocked."""
    origin = request.headers.get("origin", "")
    cors_origin = origin if origin in _ALLOWED_ORIGINS else _ALLOWED_ORIGINS[0]
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {exc}"},
        headers={
            "Access-Control-Allow-Origin": cors_origin,
            "Access-Control-Allow-Credentials": "true",
        },
    )

# ── Routers ──────────────────────────────────────────────────────────────
from .routers import auth, events, participants, templates, certificates, verify, image_templates
from .routers.role_presets import router as role_presets_router
from .domains.student.routers import router as student_router
from .domains.guest.routers import router as guest_router
from .domains.dept.routers import router as dept_router
from .domains.club.routers import router as club_router, coordinator_router as club_coordinator_router
from .domains.superadmin.routers import router as superadmin_router

app.include_router(auth.router)
app.include_router(superadmin_router)
app.include_router(club_router)
app.include_router(club_coordinator_router)
app.include_router(events.router)
app.include_router(participants.router)
app.include_router(templates.router)
app.include_router(certificates.router)
app.include_router(verify.router)
app.include_router(student_router)
app.include_router(dept_router)
app.include_router(image_templates.router)
app.include_router(guest_router)
app.include_router(role_presets_router)

# ── Static files (PNG templates, fonts, etc.) ────────────────────────────────
from pathlib import Path

_static_dir = Path(__file__).parent / "static"
if _static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")


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

from .domains.dept.routers import router as dept_router
from .domains.club.routers import router as club_router, coordinator_router as club_coordinator_router
from .domains.superadmin.routers import router as superadmin_router