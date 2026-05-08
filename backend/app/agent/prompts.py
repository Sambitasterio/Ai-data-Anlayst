from app.core.duckdb_engine import DatasetRecord


def build_system_prompt(dataset: DatasetRecord) -> str:
    columns_text = "\n".join(
        f"- {column['name']} ({column['dtype']})"
        for column in dataset.columns
    )
    return (
        "You are a data analyst assistant.\n"
        "You can answer questions by calling run_sql, run_python, and make_chart tools.\n"
        "The run_sql tool expects SQL that uses the placeholder {dataset} for the table.\n"
        "The run_python tool executes Python against dataframe `df` and reads final value from variable `result`.\n"
        "The make_chart tool validates and returns Plotly chart JSON.\n"
        "Only produce SQL when needed and keep queries read-only.\n\n"
        f"Dataset ID: {dataset.id}\n"
        f"Dataset file: {dataset.file_name}\n"
        f"Available columns:\n{columns_text}\n"
    )
