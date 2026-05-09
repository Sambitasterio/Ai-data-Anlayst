from pathlib import Path
from urllib.parse import quote_plus

from cryptography.fernet import Fernet
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

from app.core.config import BASE_DIR

READ_ONLY_PREFIXES = ("select", "with", "show", "describe", "pragma", "explain")
BLOCKED_SQL_KEYWORDS = (
    "insert",
    "update",
    "delete",
    "drop",
    "alter",
    "create",
    "truncate",
    "grant",
    "revoke",
    "merge",
    "replace",
    "attach",
    "detach",
)


def _key_file_path() -> Path:
    return Path(BASE_DIR) / "backend" / ".sql_credentials.key"


def _get_or_create_key() -> bytes:
    path = _key_file_path()
    if path.exists():
        return path.read_bytes()
    key = Fernet.generate_key()
    path.write_bytes(key)
    return key


def get_cipher() -> Fernet:
    return Fernet(_get_or_create_key())


def encrypt_text(value: str) -> str:
    return get_cipher().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_text(value: str) -> str:
    return get_cipher().decrypt(value.encode("utf-8")).decode("utf-8")


def build_connection_url(
    *,
    db_type: str,
    host: str | None = None,
    port: int | None = None,
    username: str | None = None,
    password: str | None = None,
    database: str | None = None,
    sqlite_path: str | None = None,
) -> str:
    normalized = db_type.lower().strip()
    if normalized == "postgres":
        if not all([host, port, username, password, database]):
            raise ValueError("postgres requires host, port, username, password, database")
        return (
            f"postgresql+psycopg2://{quote_plus(username)}:{quote_plus(password)}"
            f"@{host}:{port}/{database}"
        )
    if normalized == "mysql":
        if not all([host, port, username, password, database]):
            raise ValueError("mysql requires host, port, username, password, database")
        return (
            f"mysql+pymysql://{quote_plus(username)}:{quote_plus(password)}"
            f"@{host}:{port}/{database}"
        )
    if normalized == "sqlite":
        if not sqlite_path:
            raise ValueError("sqlite requires sqlite_path")
        return f"sqlite:///{sqlite_path}"
    raise ValueError("Unsupported db_type. Allowed: postgres, mysql, sqlite")


def create_sql_engine(url: str) -> Engine:
    return create_engine(url, pool_pre_ping=True)


def ensure_read_only_query(query: str) -> None:
    normalized = query.strip().lower()
    if not normalized:
        raise ValueError("SQL query cannot be empty")
    if not normalized.startswith(READ_ONLY_PREFIXES):
        raise ValueError("Only read-only SELECT/SHOW/DESCRIBE/PRAGMA/EXPLAIN queries are allowed")
    for keyword in BLOCKED_SQL_KEYWORDS:
        if f"{keyword} " in normalized:
            raise ValueError(f"Read-only guardrail blocked keyword: {keyword}")


def preview_schema(engine: Engine) -> list[dict[str, object]]:
    inspector = inspect(engine)
    schema_rows: list[dict[str, object]] = []
    for table in inspector.get_table_names():
        columns = inspector.get_columns(table)
        schema_rows.append(
            {
                "table": table,
                "columns": [
                    {"name": col["name"], "type": str(col.get("type", "unknown"))}
                    for col in columns
                ],
            }
        )
    return schema_rows


def run_query(engine: Engine, query: str, limit: int = 200) -> list[dict[str, object]]:
    ensure_read_only_query(query)
    with engine.connect() as connection:
        rows = connection.execute(text(query)).mappings().all()
    return [dict(row) for row in rows[:limit]]
