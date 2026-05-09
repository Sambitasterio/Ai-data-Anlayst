from sqlalchemy.orm import Session

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
