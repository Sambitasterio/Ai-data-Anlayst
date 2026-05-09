import logging
import re
from typing import Literal, TypedDict

from langgraph.graph import END, StateGraph

logger = logging.getLogger(__name__)

from app.agent.llm_sql import try_llm_sql_for_upload
from app.agent.tools import make_chart, run_python, run_sql
from app.core.config import get_settings
from app.core.duckdb_engine import get_duckdb_engine


def _final_user_question(question: str) -> str:
    marker = "Final user question:"
    if marker in question:
        return question.split(marker, maxsplit=1)[1].strip()
    return question


def _extract_top_limit(text: str, default: int = 5) -> int:
    m = re.search(r"\btop\s*(\d+)\b", text, re.IGNORECASE)
    if m:
        return min(max(int(m.group(1)), 1), 500)
    return default


def _wants_top_line_revenue(text: str) -> bool:
    if "top" not in text:
        return False
    if "line revenue" in text:
        return True
    if "order" in text and ("revenue" in text or "line" in text):
        return True
    return False


def _wants_region_row_filter(text: str) -> bool:
    t = text.lower()
    cardinals_re = (r"\bnorth\b", r"\bsouth\b", r"\beast\b", r"\bwest\b")
    if not any(re.search(p, t) for p in cardinals_re):
        return False
    if "region" in t:
        return True
    if "where" in t or "all rows" in t or "filter" in t or "only" in t:
        return True
    if "rows" in t:
        return True
    return False


def _region_label_for_filter(text: str) -> str | None:
    """Match sample data region values North/South/East/West (first whole-word match)."""
    t = text.lower()
    for token, label in (
        ("north", "North"),
        ("south", "South"),
        ("east", "East"),
        ("west", "West"),
    ):
        if re.search(rf"\b{token}\b", t):
            return label
    return None


def _wants_column_schema(text: str) -> bool:
    t = text.lower()
    if "what columns" in t or "which columns" in t:
        return True
    if "list" in t and "column" in t:
        return True
    if "column" in t and ("name" in t or "type" in t or "dtype" in t):
        return True
    if "schema" in t and ("column" in t or "table" in t or "dataset" in t):
        return True
    return False


class AgentState(TypedDict):
    question: str
    dataset_id: str
    plan: str
    attempt: int
    answer: str
    sql: str
    python: str
    error: str
    warning: str
    transitions: list[str]


def _append_transition(state: AgentState, node_name: str) -> list[str]:
    return [*state.get("transitions", []), node_name]


def _plan_node(state: AgentState) -> AgentState:
    question_text = state["question"]
    marker = "Final user question:"
    if marker in question_text:
        # When conversation context is prepended, route based on the latest turn only.
        question_text = question_text.split(marker, maxsplit=1)[1].strip()
    text = question_text.lower()
    if "run_python" in text or "python" in text:
        plan = "python_total_quantity"
    elif "chart" in text or "plotly" in text or "make_chart" in text:
        plan = "chart_by_category"
    elif "revenue" in text and "category" in text:
        plan = "sql_revenue_by_category"
    elif _wants_top_line_revenue(text):
        plan = "sql_top_line_revenue"
    elif _wants_region_row_filter(text):
        plan = "sql_filter_region"
    elif _wants_column_schema(text):
        plan = "dataset_schema"
    elif "how many rows" in text or "row count" in text:
        plan = "sql_row_count"
    else:
        plan = "sql_preview"

    return {
        **state,
        "plan": plan,
        "transitions": _append_transition(state, "plan"),
    }


def _execute_node(state: AgentState) -> AgentState:
    try:
        if state["plan"] == "python_total_quantity":
            answer = run_python(
                code=(
                    "result = int(df['quantity'].sum()) "
                    "if 'quantity' in df.columns else len(df)"
                ),
                dataset_id=state["dataset_id"],
            )
            return {
                **state,
                "answer": answer,
                "sql": "run_python",
                "python": (
                    "result = int(df['quantity'].sum()) "
                    "if 'quantity' in df.columns else len(df)"
                ),
                "error": "",
                "warning": "",
                "transitions": _append_transition(state, "execute"),
            }

        if state["plan"] == "chart_by_category":
            import ast

            question_text = state["question"].lower()
            chart_type = "bar"
            x_key = "category"
            y_key = "total_quantity"
            y_title = "Quantity"
            title = "Quantity by Category"

            if "revenue" in question_text and "region" in question_text:
                sql_query = (
                    "SELECT region, SUM(quantity * unit_price) AS total_revenue "
                    "FROM {dataset} GROUP BY region ORDER BY total_revenue DESC"
                )
                x_key = "region"
                y_key = "total_revenue"
                y_title = "Revenue"
                title = "Revenue by Region"
            elif "revenue" in question_text and "category" in question_text:
                sql_query = (
                    "SELECT category, SUM(quantity * unit_price) AS total_revenue "
                    "FROM {dataset} GROUP BY category ORDER BY total_revenue DESC"
                )
                x_key = "category"
                y_key = "total_revenue"
                y_title = "Revenue"
                title = "Revenue by Category"
            elif "customer" in question_text and ("top" in question_text or "spend" in question_text):
                sql_query = (
                    "SELECT customer, SUM(quantity * unit_price) AS total_spend "
                    "FROM {dataset} GROUP BY customer ORDER BY total_spend DESC LIMIT 5"
                )
                x_key = "customer"
                y_key = "total_spend"
                y_title = "Total Spend"
                title = "Top 5 Customers by Total Spend"
            elif "daily" in question_text or "order_date" in question_text or "date" in question_text:
                sql_query = (
                    "SELECT order_date, SUM(quantity * unit_price) AS total_revenue "
                    "FROM {dataset} GROUP BY order_date ORDER BY order_date"
                )
                chart_type = "scatter"
                x_key = "order_date"
                y_key = "total_revenue"
                y_title = "Revenue"
                title = "Daily Total Revenue"
            elif "top 5" in question_text and "category" in question_text:
                sql_query = (
                    "SELECT category, SUM(quantity) AS total_quantity "
                    "FROM {dataset} GROUP BY category ORDER BY total_quantity DESC LIMIT 5"
                )
                x_key = "category"
                y_key = "total_quantity"
                y_title = "Quantity"
                title = "Top 5 Categories by Quantity"
            else:
                sql_query = (
                    "SELECT category, SUM(quantity) AS total_quantity "
                    "FROM {dataset} GROUP BY category ORDER BY total_quantity DESC"
                )

            rows = run_sql(
                query=sql_query,
                dataset_id=state["dataset_id"],
            )
            parsed_rows = ast.literal_eval(rows)
            chart_spec = {
                "data": [
                    {
                        "type": chart_type,
                        "mode": "lines+markers" if chart_type == "scatter" else None,
                        "x": [row.get(x_key) for row in parsed_rows],
                        "y": [row.get(y_key) for row in parsed_rows],
                    }
                ],
                "layout": {
                    "title": title,
                    "xaxis": {"title": x_key.replace("_", " ").title()},
                    "yaxis": {"title": y_title},
                },
            }
            if chart_type == "bar":
                # Helps with long category/customer labels.
                chart_spec["layout"]["xaxis"]["tickangle"] = -20

            # Remove `mode` for bar charts to keep Plotly payload clean.
            if chart_type != "scatter":
                chart_spec["data"][0].pop("mode", None)

            answer = make_chart(str(chart_spec))
            return {
                **state,
                "answer": answer,
                "sql": sql_query,
                "error": "",
                "warning": "",
                "python": "",
                "transitions": _append_transition(state, "execute"),
            }

        if state["plan"] == "sql_revenue_by_category":
            query = (
                "SELECT category, SUM(quantity * unit_price) AS total_revenue "
                "FROM {dataset} GROUP BY category ORDER BY total_revenue DESC"
            )
            answer = run_sql(query=query, dataset_id=state["dataset_id"])
            return {
                **state,
                "answer": answer,
                "sql": query,
                "error": "",
                "warning": "",
                "python": "",
                "transitions": _append_transition(state, "execute"),
            }

        if state["plan"] == "sql_top_line_revenue":
            qt = _final_user_question(state["question"]).lower()
            n = _extract_top_limit(qt, default=3)
            query = (
                "SELECT * FROM {dataset} ORDER BY (quantity * unit_price) DESC "
                f"LIMIT {n}"
            )
            answer = run_sql(query=query, dataset_id=state["dataset_id"])
            return {
                **state,
                "answer": answer,
                "sql": query,
                "error": "",
                "warning": "",
                "python": "",
                "transitions": _append_transition(state, "execute"),
            }

        if state["plan"] == "sql_filter_region":
            qt = _final_user_question(state["question"]).lower()
            label = _region_label_for_filter(qt)
            if label is None:
                query = "SELECT * FROM {dataset} LIMIT 5"
                region_warning = (
                    "Could not detect a region (North/South/East/West) in your question; "
                    "showing the first 5 rows only."
                )
            else:
                safe = label.replace("'", "''")
                query = f"SELECT * FROM {{dataset}} WHERE region = '{safe}'"
                region_warning = ""
            answer = run_sql(query=query, dataset_id=state["dataset_id"])
            return {
                **state,
                "answer": answer,
                "sql": query,
                "error": "",
                "warning": region_warning,
                "python": "",
                "transitions": _append_transition(state, "execute"),
            }

        if state["plan"] == "dataset_schema":
            did = state["dataset_id"]
            if did.startswith("sql:"):
                answer = (
                    "This chat is using a live SQL connection. Use the connector’s schema or ask "
                    "for database metadata (e.g. information_schema) in your question."
                )
            else:
                eng = get_duckdb_engine(get_settings().uploads_dir)
                rec = eng.get_dataset(did)
                lines = [f"- {c['name']}: {c['dtype']}" for c in rec.columns]
                answer = "Column names and dtypes:\n" + "\n".join(lines)
            return {
                **state,
                "answer": answer,
                "sql": "",
                "error": "",
                "warning": "",
                "python": "",
                "transitions": _append_transition(state, "execute"),
            }

        preview_warning = ""
        if state["plan"] == "sql_row_count":
            query = "SELECT COUNT(*) AS row_count FROM {dataset}"
        else:
            question_text = _final_user_question(state["question"])
            generated = try_llm_sql_for_upload(
                question_text,
                state["dataset_id"],
                retry_attempt=state.get("attempt", 0),
            )
            query = generated if generated else "SELECT * FROM {dataset} LIMIT 5"
            if not generated:
                preview_warning = (
                    "Preview only: no built-in template matched and no SQL was generated "
                    "(set OPENAI_API_KEY in `.env` for broader natural-language SQL). "
                    "Showing the first 5 rows — this may not answer your question."
                )
        answer = run_sql(query=query, dataset_id=state["dataset_id"])
        return {
            **state,
            "answer": answer,
            "sql": query,
            "error": "",
            "warning": preview_warning,
            "python": "",
            "transitions": _append_transition(state, "execute"),
        }
    except Exception as exc:
        logger.warning("execute node failed: %s", exc)
        return {
            **state,
            "error": str(exc),
            "warning": "",
            "transitions": _append_transition(state, "execute"),
        }


def _reflect_node(state: AgentState) -> AgentState:
    # Retry once with a safer fallback query when execution fails.
    if state.get("error") and state.get("attempt", 0) < 1:
        return {
            **state,
            "attempt": state.get("attempt", 0) + 1,
            "plan": "sql_preview",
            "sql": "",
            "answer": "",
            "error": "",
            "python": "",
            "warning": "",
            "transitions": _append_transition(state, "reflect"),
        }

    return {
        **state,
        "transitions": _append_transition(state, "reflect"),
    }


def _reflect_route(state: AgentState) -> Literal["execute", "respond"]:
    if state.get("error"):
        return "respond"
    if state.get("answer"):
        return "respond"
    return "execute"


def _respond_node(state: AgentState) -> AgentState:
    if state.get("answer"):
        return {
            **state,
            "transitions": _append_transition(state, "respond"),
        }

    return {
        **state,
        "answer": f"Unable to answer: {state.get('error', 'unknown error')}",
        "sql": state.get("sql", ""),
        "python": state.get("python", ""),
        "transitions": _append_transition(state, "respond"),
    }


_graph = StateGraph(AgentState)
_graph.add_node("plan", _plan_node)
_graph.add_node("execute", _execute_node)
_graph.add_node("reflect", _reflect_node)
_graph.add_node("respond", _respond_node)
_graph.set_entry_point("plan")
_graph.add_edge("plan", "execute")
_graph.add_edge("execute", "reflect")
_graph.add_conditional_edges(
    "reflect",
    _reflect_route,
    {
        "execute": "execute",
        "respond": "respond",
    },
)
_graph.add_edge("respond", END)
agent_graph = _graph.compile()


def ask_dataset(question: str, dataset_id: str) -> dict[str, str | list[str]]:
    initial_state: AgentState = {
        "question": question,
        "dataset_id": dataset_id,
        "plan": "",
        "attempt": 0,
        "answer": "",
        "sql": "",
        "python": "",
        "error": "",
        "warning": "",
        "transitions": [],
    }
    final_state = agent_graph.invoke(initial_state)
    return {
        "answer": str(final_state.get("answer", "")),
        "sql": str(final_state.get("sql", "")),
        "python": str(final_state.get("python", "")),
        "warning": str(final_state.get("warning", "")),
        "transitions": list(final_state.get("transitions", [])),
    }
