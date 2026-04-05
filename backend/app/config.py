from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[1] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────
    app_env: Literal["development", "production"] = "development"
    secret_key: str = "replace-with-random-64-char-hex-string"
    algorithm: str = "HS256"
    frontend_url: str = "http://localhost:5173"
    base_url: str = "https://certs.psgit.edu"

    # ── MongoDB ──────────────────────────────────────────────────────────
    mongodb_url: str = "mongodb://localhost:27017"
    db_name: str = "psgicerts"

    # ── JWT ──────────────────────────────────────────────────────────────
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # ── Storage ──────────────────────────────────────────────────────────
    storage_path: str = "./storage"

    # ── Email (SMTP) ─────────────────────────────────────────────────────
    email_provider: Literal["gmail_smtp", "brevo", "console"] = "console"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""           # Gmail App Password or Brevo SMTP key
    email_sender: str = "certs@psgit.edu"
    email_sender_name: str = "PSG iTech Certificates"
    email_daily_limit: int = 500

    # ── Super Admin Seed ─────────────────────────────────────────────────
    superadmin_username: str = "superadmin"
    superadmin_password: str = "change-me-on-first-run"
    superadmin_email: str = "admin@psgit.edu"
    superadmin_name: str = "Platform Admin"

    # ── Derived helpers ──────────────────────────────────────────────────

    @property
    def project_root(self) -> Path:
        """Workspace root (parent of backend/)."""
        return Path(__file__).resolve().parents[2]

    @property
    def storage_root(self) -> Path:
        """Absolute storage root, stable across different launch directories."""
        p = Path(self.storage_path)
        if p.is_absolute():
            return p.resolve()
        return (self.project_root / p).resolve()

    @property
    def certs_dir(self) -> Path:
        """Absolute path to certificate PNG storage."""
        return self.storage_root / "certs"

    @property
    def assets_dir(self) -> Path:
        """Absolute path to club asset storage (logos, signatures)."""
        return self.storage_root / "assets"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    def ensure_storage_dirs(self) -> None:
        """Create storage directories if they don't exist."""
        self.certs_dir.mkdir(parents=True, exist_ok=True)
        self.assets_dir.mkdir(parents=True, exist_ok=True)
        (self.storage_root / "dept_templates").mkdir(parents=True, exist_ok=True)
        (self.storage_root / "tmp").mkdir(parents=True, exist_ok=True)


@lru_cache()
def get_settings() -> Settings:
    """Singleton settings instance (cached after first call)."""
    return Settings()
