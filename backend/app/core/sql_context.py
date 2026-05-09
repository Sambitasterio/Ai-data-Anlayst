from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.duckdb_engine import get_duckdb_engine
from app.core.sql_connections import preview_schema
from app.core.sql_runtime import get_engine_for_connection
from app.models import SQLConnection


def build_schema_context_for_dataset_id(dataset_id: str, db: Session) -> str:
    if not dataset_id.startswith("sql:"):
        return ""
    connection_id = dataset_id.split("sql:", maxsplit=1)[1].strip()
    if not connection_id:
        return ""
    connection = (
        db.query(SQLConnection)
        .filter(SQLConnection.id == connection_id, SQLConnection.is_active == "1")
        .first()
    )
    if connection is None:
        return ""
    schema_rows = preview_schema(get_engine_for_connection(connection))
    if not schema_rows:
        return ""
    formatted = []
    for row in schema_rows:
        columns = ", ".join(
            f"{col['name']} ({col['type']})" for col in row.get("columns", [])[:15]
        )
        formatted.append(f"- {row['table']}: {columns}")
    return "Connected SQL schema:\n" + "\n".join(formatted[:30])


def build_uploaded_dataset_schema_context(dataset_id: str) -> str:
    """Column list for CSV/XLSX datasets registered in DuckDB (not live SQL connections)."""
    if not dataset_id or dataset_id.startswith("sql:"):
        return ""
    try:
        settings = get_settings()
        engine = get_duckdb_engine(settings.uploads_dir)
        record = engine.get_dataset(dataset_id)
    except KeyError:
        return ""
    lines = [f"- {c['name']}: {c['dtype']}" for c in record.columns[:80]]
    return (
        "The dataset is one table in DuckDB. In SQL, use the placeholder {dataset} "
        "as the only table name in FROM clauses.\n"
        "Columns:\n" + "\n".join(lines)
    )
