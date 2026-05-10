from functools import lru_cache
import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parents[3]
load_dotenv(BASE_DIR / ".env")


def _cors_origins_from_env() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if not raw:
        return ["*"]
    return [segment.strip() for segment in raw.split(",") if segment.strip()]


class Settings(BaseModel):
    app_name: str = "AI Data Analyst API"
    app_version: str = "0.1.0"
    environment: str = "development"
    cors_origins: list[str] = Field(default_factory=_cors_origins_from_env)
    uploads_dir: Path = BASE_DIR / "backend" / "uploads"
    openai_api_key: str = Field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    jwt_secret: str = os.getenv("JWT_SECRET", "change-me-in-production")
    auth_sync_secret: str = os.getenv("AUTH_SYNC_SECRET", "")


@lru_cache
def get_settings() -> Settings:
    return Settings()
