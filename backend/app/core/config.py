from functools import lru_cache
import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parents[3]
load_dotenv(BASE_DIR / ".env")


class Settings(BaseModel):
    app_name: str = "AI Data Analyst API"
    app_version: str = "0.1.0"
    environment: str = "development"
    cors_origins: list[str] = ["*"]
    uploads_dir: Path = BASE_DIR / "backend" / "uploads"
    openai_api_key: str = Field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    jwt_secret: str = os.getenv("JWT_SECRET", "change-me-in-production")
    auth_sync_secret: str = os.getenv("AUTH_SYNC_SECRET", "")


@lru_cache
def get_settings() -> Settings:
    return Settings()
