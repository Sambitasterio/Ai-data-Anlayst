from langchain_core.tools import StructuredTool

from app.core.config import get_settings
from app.core.duckdb_engine import get_duckdb_engine


def run_sql(query: str, dataset_id: str) -> str:
    settings = get_settings()
    engine = get_duckdb_engine(settings.uploads_dir)
    rows = engine.run_sql(dataset_id=dataset_id, query=query)
    return str(rows)


def get_run_sql_tool() -> StructuredTool:
    return StructuredTool.from_function(
        func=run_sql,
        name="run_sql",
        description=(
            "Run a read-only SQL query on the selected dataset. "
            "Use {dataset} in FROM clauses as the table placeholder."
        ),
    )
