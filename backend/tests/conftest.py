from __future__ import annotations

from pathlib import Path

import pytest

from app.core.duckdb_engine import DuckDBEngine, reset_duckdb_engine_singleton


@pytest.fixture
def uploads_tmp(tmp_path: Path) -> Path:
    uploads = tmp_path / "uploads"
    uploads.mkdir(parents=True, exist_ok=True)
    return uploads


@pytest.fixture
def duck_engine(uploads_tmp: Path) -> DuckDBEngine:
    return DuckDBEngine(uploads_tmp)


@pytest.fixture(autouse=True)
def _reset_globals():
    reset_duckdb_engine_singleton()
    yield
    reset_duckdb_engine_singleton()


@pytest.fixture
def duck_patched(monkeypatch, uploads_tmp: Path) -> DuckDBEngine:
    """Shared isolated DuckDB + monkeypatch hooks used by agent + llm_sql."""
    duck = DuckDBEngine(uploads_tmp)
    monkeypatch.setattr("app.agent.tools.get_duckdb_engine", lambda *a, **k: duck)
    monkeypatch.setattr("app.agent.graph.get_duckdb_engine", lambda *a, **k: duck)
    monkeypatch.setattr("app.agent.llm_sql.get_duckdb_engine", lambda *a, **k: duck)
    return duck


@pytest.fixture
def orders_dataset_id(duck_patched: DuckDBEngine, tmp_path: Path) -> str:
    csv_path = tmp_path / "incoming.csv"
    csv_path.write_text(
        "order_id,customer,region,category,quantity,unit_price,order_date\n"
        "1001,Alice,North,Electronics,2,499.99,2026-01-05\n"
        "1002,Bob,West,Furniture,1,100.00,2026-01-06\n"
        "1003,Charlie,South,Office Supplies,10,12.75,2026-01-07\n",
        encoding="utf-8",
    )
    return duck_patched.register_upload(csv_path, "orders.csv").id


@pytest.fixture
def disable_llm_sql(monkeypatch):
    monkeypatch.setattr(
        "app.agent.llm_sql.try_llm_sql_for_upload",
        lambda *a, **k: None,
    )
