from sqlalchemy.engine import Engine

from app.core.sql_connections import create_sql_engine, decrypt_text, run_query
from app.models import SQLConnection

_ENGINE_CACHE: dict[str, Engine] = {}


def get_engine_for_connection(connection: SQLConnection) -> Engine:
    cached = _ENGINE_CACHE.get(connection.id)
    if cached is not None:
        return cached
    url = decrypt_text(connection.encrypted_url)
    engine = create_sql_engine(url)
    _ENGINE_CACHE[connection.id] = engine
    return engine


def run_connection_query(connection: SQLConnection, query: str) -> list[dict[str, object]]:
    engine = get_engine_for_connection(connection)
    return run_query(engine=engine, query=query)


def clear_connection_cache(connection_id: str) -> None:
    engine = _ENGINE_CACHE.pop(connection_id, None)
    if engine is not None:
        engine.dispose()
