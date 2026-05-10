"""Deployment helpers (demo dataset seed)."""

from __future__ import annotations

import logging
import os
import shutil
from pathlib import Path
from uuid import uuid4

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def maybe_seed_demo_csv() -> None:
    flag = os.getenv("AUTOLOAD_DEMO_SAMPLE", "").strip().lower()
    if flag not in ("1", "true", "yes"):
        return

    fixtures = Path(__file__).resolve().parents[1] / "fixtures" / "demo_sample.csv"
    if not fixtures.is_file():
        logger.warning("AUTOLOAD_DEMO_SAMPLE set but %s missing", fixtures)
        return

    from app.core.duckdb_engine import get_duckdb_engine

    settings = get_settings()
    uploads = settings.uploads_dir
    uploads.mkdir(parents=True, exist_ok=True)
    duck = get_duckdb_engine(uploads)
    if duck.list_datasets():
        return
    tmp = uploads / f"demo_seed_{uuid4()}.csv"
    shutil.copy(fixtures, tmp)
    duck.register_upload(tmp, "demo_sample.csv")
