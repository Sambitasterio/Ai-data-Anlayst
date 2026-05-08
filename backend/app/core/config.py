from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel


BASE_DIR = Path(__file__).resolve().parents[3]
load_dotenv(BASE_DIR / ".env")


class Settings(BaseModel):
    app_name: str = "AI Data Analyst API"
    app_version: str = "0.1.0"
    environment: str = "development"
    cors_origins: list[str] = ["*"]
    uploads_dir: Path = BASE_DIR / "backend" / "uploads"


@lru_cache
def get_settings() -> Settings:
    return Settings()
