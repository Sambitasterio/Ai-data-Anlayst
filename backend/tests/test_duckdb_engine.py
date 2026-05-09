from pathlib import Path

from app.core.duckdb_engine import DuckDBEngine


def test_dataset_placeholder_rewrite(uploads_tmp: Path, tmp_path: Path) -> None:
    engine = DuckDBEngine(uploads_tmp)
    src = tmp_path / "small.csv"
    src.write_text("a,b\n1,hello\n")
    record = engine.register_upload(src, "small.csv")

    rows = engine.run_sql(dataset_id=record.id, query="SELECT * FROM {dataset} LIMIT 10")
    assert len(rows) == 1
    assert rows[0]["a"] == 1
    assert rows[0]["b"] == "hello"


def test_run_sql_strips_trailing_semicolon(uploads_tmp: Path, tmp_path: Path) -> None:
    engine = DuckDBEngine(uploads_tmp)
    src = tmp_path / "x.csv"
    src.write_text("n\n42\n")
    record = engine.register_upload(src, "x.csv")

    rows = engine.run_sql(dataset_id=record.id, query="SELECT * FROM {dataset} LIMIT 5; ")
    assert len(rows) == 1


def test_non_select_rejected(uploads_tmp: Path, tmp_path: Path) -> None:
    engine = DuckDBEngine(uploads_tmp)
    src = tmp_path / "x.csv"
    src.write_text("n\n1\n")
    record = engine.register_upload(src, "x.csv")

    try:
        engine.run_sql(record.id, "DELETE FROM {dataset}")
        raise AssertionError("expected ValueError")
    except ValueError as exc:
        assert "SELECT" in str(exc)
