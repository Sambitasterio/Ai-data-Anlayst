"""Optional OpenAI-backed SQL generation for uploaded (DuckDB) datasets."""

import logging
import os
import re

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.core.config import BASE_DIR, get_settings
from app.core.duckdb_engine import get_duckdb_engine

logger = logging.getLogger(__name__)


def _parse_sql_block(text: str) -> str:
    text = text.strip()
    if "```" in text:
        parts = text.split("```", 2)
        if len(parts) >= 2:
            block = parts[1]
            if block.lstrip().lower().startswith("sql"):
                nl = block.find("\n")
                block = block[nl + 1 :] if nl != -1 else ""
            text = block.strip()
    return text.strip().rstrip(";")


def _force_dataset_placeholder(sql: str) -> str:
    """Ensure {dataset} appears for duckdb_engine replacement if the model used a fake table name."""
    if "{dataset}" in sql:
        return sql
    # First FROM … (optional alias), DuckDB-style / quoted identifiers
    patched = re.sub(
        r"(?is)\bFROM\s+(?:`[^`]+`|\[[^\]]+\]|[\w.]+)(?:\s+(?:AS\s+)?[\w.]+)?",
        "FROM {dataset}",
        sql,
        count=1,
    )
    return patched


def try_llm_sql_for_upload(question: str, dataset_id: str, *, retry_attempt: int) -> str | None:
    """Return a single SELECT using {dataset} as the table placeholder, or None to fall back."""
    if retry_attempt > 0 or dataset_id.startswith("sql:"):
        return None

    # Read key at call time; get_settings() is cached and Class defaults can miss .env updates.
    load_dotenv(BASE_DIR / ".env", override=True)
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        logger.warning("LLM SQL skipped: OPENAI_API_KEY is empty after loading .env")
        return None

    try:
        settings = get_settings()
        engine = get_duckdb_engine(settings.uploads_dir)
        record = engine.get_dataset(dataset_id)
    except KeyError:
        return None

    col_lines = "\n".join(
        f"  - {c['name']} ({c['dtype']})" for c in record.columns[:100]
    )
    system = SystemMessage(
        content=(
            "You write a single DuckDB-compatible SELECT query. "
            "The table must be referenced as the literal text {dataset} in the FROM clause "
            "(exactly those characters, one word). Read-only only: SELECT or WITH...SELECT. "
            "No semicolons at the end. No markdown — output only the SQL.\n\n"
            f"Columns:\n{col_lines}"
        )
    )
    human = HumanMessage(content=f"Question:\n{question}")
    try:
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0,
            api_key=api_key,
        )
        out = llm.invoke([system, human])
        raw = getattr(out, "content", str(out))
        if isinstance(raw, list):
            raw = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part) for part in raw
            )
        sql = _parse_sql_block(str(raw))
    except Exception as exc:
        logger.warning("LLM SQL call failed: %s", exc)
        return None

    if not sql.lower().strip().startswith(("select", "with")):
        logger.warning("LLM SQL rejected: not a SELECT/WITH (got %r)", sql[:120])
        return None

    sql = _force_dataset_placeholder(sql)
    if "{dataset}" not in sql:
        logger.warning("LLM SQL rejected: missing {{dataset}} after fixup (got %r)", sql[:200])
        return None
    return sql
