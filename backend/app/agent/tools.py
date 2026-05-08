import ast
import json
import logging
from datetime import datetime
from pathlib import Path

import pandas as pd
from langchain_core.tools import StructuredTool

from app.core.config import get_settings
from app.core.duckdb_engine import get_duckdb_engine

logger = logging.getLogger(__name__)


def _log_tool_use(tool: str, args: dict[str, object], result: object) -> None:
    log_payload = {
        "timestamp": datetime.utcnow().isoformat(),
        "tool": tool,
        "args": args,
        "result": result,
    }
    logger.info("tool_use=%s", json.dumps(log_payload, default=str))


def run_sql(query: str, dataset_id: str) -> str:
    settings = get_settings()
    engine = get_duckdb_engine(settings.uploads_dir)
    rows = engine.run_sql(dataset_id=dataset_id, query=query)
    _log_tool_use(
        tool="run_sql",
        args={"dataset_id": dataset_id, "query": query},
        result={"rows": len(rows)},
    )
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


def run_python(code: str, dataset_id: str) -> str:
    settings = get_settings()
    engine = get_duckdb_engine(settings.uploads_dir)
    dataset = engine.get_dataset(dataset_id)

    file_path = Path(dataset.file_path)
    if file_path.suffix.lower() == ".csv":
        dataframe = pd.read_csv(file_path)
    else:
        dataframe = pd.read_excel(file_path)

    safe_globals = {"__builtins__": {"len": len, "min": min, "max": max, "sum": sum}}
    safe_locals: dict[str, object] = {"df": dataframe, "result": None}
    exec(code, safe_globals, safe_locals)
    result = safe_locals.get("result")

    _log_tool_use(
        tool="run_python",
        args={"dataset_id": dataset_id, "code": code},
        result={"result": str(result)},
    )
    return str(result)


def get_run_python_tool() -> StructuredTool:
    return StructuredTool.from_function(
        func=run_python,
        name="run_python",
        description=(
            "Execute Python against dataframe `df` for the selected dataset. "
            "Assign final value to variable `result`."
        ),
    )


def make_chart(spec: str) -> str:
    parsed_spec: dict[str, object]
    try:
        parsed_spec = json.loads(spec)
    except json.JSONDecodeError:
        parsed_spec = ast.literal_eval(spec)

    if not isinstance(parsed_spec, dict):
        raise ValueError("Chart spec must be an object.")
    if "data" not in parsed_spec:
        raise ValueError("Chart spec must include a 'data' field.")
    if "layout" not in parsed_spec:
        parsed_spec["layout"] = {"title": "Generated Chart"}

    _log_tool_use(
        tool="make_chart",
        args={"spec_keys": list(parsed_spec.keys())},
        result={"ok": True},
    )
    return json.dumps(parsed_spec)


def get_make_chart_tool() -> StructuredTool:
    return StructuredTool.from_function(
        func=make_chart,
        name="make_chart",
        description="Validate and return a Plotly-compatible chart spec JSON.",
    )
