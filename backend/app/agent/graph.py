from typing import Literal, TypedDict

from langgraph.graph import END, StateGraph

from app.agent.tools import make_chart, run_python, run_sql


class AgentState(TypedDict):
    question: str
    dataset_id: str
    plan: str
    attempt: int
    answer: str
    sql: str
    error: str
    transitions: list[str]


def _append_transition(state: AgentState, node_name: str) -> list[str]:
    return [*state.get("transitions", []), node_name]


def _plan_node(state: AgentState) -> AgentState:
    text = state["question"].lower()
    if "run_python" in text or "python" in text:
        plan = "python_total_quantity"
    elif "chart" in text or "plotly" in text or "make_chart" in text:
        plan = "chart_by_category"
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
                "error": "",
                "transitions": _append_transition(state, "execute"),
            }

        if state["plan"] == "chart_by_category":
            rows = run_sql(
                query=(
                    "SELECT category, SUM(quantity) AS total_quantity "
                    "FROM {dataset} GROUP BY category ORDER BY total_quantity DESC"
                ),
                dataset_id=state["dataset_id"],
            )
            import ast

            parsed_rows = ast.literal_eval(rows)
            chart_spec = {
                "data": [
                    {
                        "type": "bar",
                        "x": [row.get("category") for row in parsed_rows],
                        "y": [row.get("total_quantity") for row in parsed_rows],
                    }
                ],
                "layout": {"title": "Quantity by Category"},
            }
            answer = make_chart(str(chart_spec))
            return {
                **state,
                "answer": answer,
                "sql": (
                    "SELECT category, SUM(quantity) AS total_quantity FROM {dataset} "
                    "GROUP BY category ORDER BY total_quantity DESC"
                ),
                "error": "",
                "transitions": _append_transition(state, "execute"),
            }

        query = (
            "SELECT COUNT(*) AS row_count FROM {dataset}"
            if state["plan"] == "sql_row_count"
            else "SELECT * FROM {dataset} LIMIT 5"
        )
        answer = run_sql(query=query, dataset_id=state["dataset_id"])
        return {
            **state,
            "answer": answer,
            "sql": query,
            "error": "",
            "transitions": _append_transition(state, "execute"),
        }
    except Exception as exc:
        return {
            **state,
            "error": str(exc),
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
        "error": "",
        "transitions": [],
    }
    final_state = agent_graph.invoke(initial_state)
    return {
        "answer": str(final_state.get("answer", "")),
        "sql": str(final_state.get("sql", "")),
        "transitions": list(final_state.get("transitions", [])),
    }
