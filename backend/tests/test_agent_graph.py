from __future__ import annotations

import ast

import pytest

from app.agent import graph as graph_module
from app.agent.graph import ask_dataset


@pytest.fixture
def tiny_dataset_id(duck_patched, tmp_path):  # noqa: ANN001
    csv_path = tmp_path / "two.csv"
    csv_path.write_text("x,y\n1,aa\n")
    return duck_patched.register_upload(csv_path, "two.csv").id


def test_ask_dataset_revenue_by_category(orders_dataset_id: str, disable_llm_sql) -> None:
    q = "What is total revenue by category?"
    result = ask_dataset(question=q, dataset_id=orders_dataset_id)
    assert "group by category" in result["sql"].lower()
    parsed = ast.literal_eval(result["answer"])
    cats = {row["category"] for row in parsed}
    assert {"Electronics", "Furniture", "Office Supplies"} == cats


def test_ask_dataset_schema_list(tiny_dataset_id: str) -> None:
    result = ask_dataset(
        question="List the column names and their types.",
        dataset_id=tiny_dataset_id,
    )
    body = result["answer"]
    assert "Column names" in body or "dtype" in body
    assert "x" in body and "y" in body


def test_preview_fallback_warning(orders_dataset_id: str, disable_llm_sql) -> None:
    result = ask_dataset(question="zzz unknown intent frakj4832!", dataset_id=orders_dataset_id)
    assert "LIMIT 5" in result["sql"].replace("\n", " ")
    assert "Preview only" in (result.get("warning") or "")


@pytest.mark.parametrize(
    ("phrase", "checker"),
    [
        ("List the columns and dtypes", lambda f: graph_module._wants_column_schema(f)),
        ("all rows where region is north", lambda f: graph_module._wants_region_row_filter(f)),
        ("top 3 orders by line revenue", lambda f: graph_module._wants_top_line_revenue(f)),
    ],
)
def test_planner_flags(phrase: str, checker) -> None:
    assert checker(phrase.lower()) is True
