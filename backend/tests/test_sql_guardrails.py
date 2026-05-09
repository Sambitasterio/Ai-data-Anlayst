import pytest

from app.core.sql_connections import ensure_read_only_query


def test_allow_select_star() -> None:
    ensure_read_only_query("SELECT * FROM t")


def test_block_delete() -> None:
    with pytest.raises(ValueError, match="blocked|read-only|Read-only"):
        ensure_read_only_query("DELETE FROM orders")
