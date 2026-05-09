from pathlib import Path
from threading import Lock
from uuid import uuid4

import duckdb
import pandas as pd
from pydantic import BaseModel


class DatasetRecord(BaseModel):
    id: str
    file_name: str
    stored_file_name: str
    file_path: str
    view_name: str
    columns: list[dict[str, str]]


class DuckDBEngine:
    def __init__(self, uploads_dir: Path) -> None:
        self.uploads_dir = uploads_dir
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.conn = duckdb.connect(database=":memory:")
        self.datasets: dict[str, DatasetRecord] = {}
        self._lock = Lock()

    def _read_dataset(self, file_path: Path) -> pd.DataFrame:
        if file_path.suffix.lower() == ".csv":
            return pd.read_csv(file_path)
        return pd.read_excel(file_path)

    def register_upload(self, source_path: Path, original_name: str) -> DatasetRecord:
        dataset_id = str(uuid4())
        stored_file_name = f"{dataset_id}{source_path.suffix.lower()}"
        target_path = self.uploads_dir / stored_file_name
        source_path.rename(target_path)

        dataframe = self._read_dataset(target_path)
        view_name = f"dataset_{dataset_id.replace('-', '_')}"

        with self._lock:
            self.conn.register(view_name, dataframe)

            columns = [
                {"name": column_name, "dtype": str(dtype)}
                for column_name, dtype in dataframe.dtypes.items()
            ]
            record = DatasetRecord(
                id=dataset_id,
                file_name=original_name,
                stored_file_name=stored_file_name,
                file_path=str(target_path),
                view_name=view_name,
                columns=columns,
            )
            self.datasets[dataset_id] = record

        return record

    def list_datasets(self) -> list[DatasetRecord]:
        return list(self.datasets.values())

    def get_dataset(self, dataset_id: str) -> DatasetRecord:
        record = self.datasets.get(dataset_id)
        if record is None:
            raise KeyError(dataset_id)
        return record

    def preview_dataset(self, dataset_id: str, limit: int = 20) -> list[dict[str, object]]:
        record = self.get_dataset(dataset_id)

        query = f"SELECT * FROM {record.view_name} LIMIT ?"
        rows = self.conn.execute(query, [limit]).fetchdf()
        return rows.to_dict(orient="records")

    def run_sql(self, dataset_id: str, query: str) -> list[dict[str, object]]:
        record = self.get_dataset(dataset_id)
        normalized_query = query.strip().rstrip(";")
        if not normalized_query.lower().startswith("select"):
            raise ValueError("Only read-only SELECT queries are allowed.")

        rewritten_query = normalized_query.replace("{dataset}", record.view_name)
        rows = self.conn.execute(rewritten_query).fetchdf()
        return rows.to_dict(orient="records")


duckdb_engine: DuckDBEngine | None = None


def get_duckdb_engine(uploads_dir: Path) -> DuckDBEngine:
    global duckdb_engine
    if duckdb_engine is None:
        duckdb_engine = DuckDBEngine(uploads_dir=uploads_dir)
    return duckdb_engine


def reset_duckdb_engine_singleton() -> None:
    """Clears process-wide DuckDB engine (pytest / tooling)."""
    global duckdb_engine
    duckdb_engine = None
