from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.core.sql_connections import (
    build_connection_url,
    create_sql_engine,
    encrypt_text,
    preview_schema,
)
from app.core.sql_runtime import clear_connection_cache
from app.models import SQLConnection
from app.schemas import (
    SQLConnectionConnectRequest,
    SQLConnectionStatusResponse,
    SQLConnectionSummaryResponse,
    SQLTableSchema,
)

router = APIRouter(prefix="/sql", tags=["sql"])


def _to_summary(connection: SQLConnection) -> SQLConnectionSummaryResponse:
    return SQLConnectionSummaryResponse(
        id=connection.id,
        name=connection.name,
        db_type=connection.db_type,
        is_active=connection.is_active == "1",
    )


@router.post("/connect", response_model=SQLConnectionStatusResponse)
def connect_sql_database(
    request: SQLConnectionConnectRequest,
    db: Session = Depends(get_db_session),
) -> SQLConnectionStatusResponse:
    try:
        url = build_connection_url(
            db_type=request.db_type,
            host=request.host,
            port=request.port,
            username=request.username,
            password=request.password,
            database=request.database,
            sqlite_path=request.sqlite_path,
        )
        engine = create_sql_engine(url)
        schema_rows = preview_schema(engine)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to connect: {exc}") from exc

    db.query(SQLConnection).update({"is_active": "0"})
    connection = SQLConnection(
        name=(request.name or "").strip() or f"{request.db_type.title()} Connection",
        db_type=request.db_type.lower().strip(),
        encrypted_url=encrypt_text(url),
        is_active="1",
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)

    return SQLConnectionStatusResponse(
        connection=_to_summary(connection),
        schema=[SQLTableSchema(**row) for row in schema_rows],
    )


@router.get("/status", response_model=SQLConnectionStatusResponse)
def get_sql_status(db: Session = Depends(get_db_session)) -> SQLConnectionStatusResponse:
    connection = (
        db.query(SQLConnection)
        .filter(SQLConnection.is_active == "1")
        .order_by(SQLConnection.updated_at.desc())
        .first()
    )
    if connection is None:
        return SQLConnectionStatusResponse(connection=None, schema=[])

    try:
        from app.core.sql_runtime import get_engine_for_connection

        engine = get_engine_for_connection(connection)
        schema_rows = preview_schema(engine)
    except Exception:
        schema_rows = []

    return SQLConnectionStatusResponse(
        connection=_to_summary(connection),
        schema=[SQLTableSchema(**row) for row in schema_rows],
    )


@router.post("/disconnect")
def disconnect_sql_database(db: Session = Depends(get_db_session)) -> dict[str, bool]:
    active = db.query(SQLConnection).filter(SQLConnection.is_active == "1").first()
    if active is None:
        return {"ok": True}
    clear_connection_cache(active.id)
    active.is_active = "0"
    db.commit()
    return {"ok": True}
