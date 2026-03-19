"""
Unit tests for src/ingestion/secop_client.py — incremental pull logic and pagination.

6 tests as specified in Week 1 DoD:
1. build_client returns a Socrata instance with correct domain and timeout
2. Pagination — multi-page fetch concatenates all pages
3. Empty response returns empty list
4. SoQL where clause uses correct :updated_at filter
5. Token is NOT present in the URL (only in X-App-Token header)
6. Single-page response (less than DEFAULT_PAGE_SIZE rows) returns immediately
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

# Module under test
from src.ingestion.secop_client import (
    DEFAULT_PAGE_SIZE,
    DATASETS,
    SOCRATA_DOMAIN,
    build_client,
    fetch_incremental,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_socrata_class():
    """Patch sodapy.Socrata constructor for build_client tests.
    
    sodapy may not be installed in the test environment, so we inject
    a mock module into sys.modules before build_client()'s local import.
    """
    import sys
    mock_socrata_cls = MagicMock()
    instance = MagicMock()
    mock_socrata_cls.return_value = instance

    mock_module = MagicMock()
    mock_module.Socrata = mock_socrata_cls

    original = sys.modules.get("sodapy")
    sys.modules["sodapy"] = mock_module
    try:
        yield mock_socrata_cls, instance
    finally:
        if original is None:
            sys.modules.pop("sodapy", None)
        else:
            sys.modules["sodapy"] = original


@pytest.fixture
def mock_app_token():
    """Patch get_socrata_app_token to return a test token."""
    with patch(
        "src.ingestion.secop_client.get_socrata_app_token",
        return_value="test-token-abc123",
    ):
        yield


# ---------------------------------------------------------------------------
# Test 1: build_client returns Socrata with correct domain and timeout
# ---------------------------------------------------------------------------

def test_build_client_creates_socrata_with_correct_params(
    mock_socrata_class, mock_app_token
):
    """build_client() should instantiate Socrata with the correct domain,
    app token, and 30-second timeout."""
    MockSocrata, instance = mock_socrata_class

    result = build_client()

    MockSocrata.assert_called_once_with(
        SOCRATA_DOMAIN,
        "test-token-abc123",
        timeout=120,
    )
    assert result is instance


# ---------------------------------------------------------------------------
# Test 2: Pagination — multi-page fetch concatenates all pages
# ---------------------------------------------------------------------------

def test_fetch_incremental_paginates_multiple_pages(mock_app_token):
    """When Socrata returns exactly DEFAULT_PAGE_SIZE rows on the first page,
    fetch_incremental should request a second page and concatenate results."""
    # Page 1: full page (triggers next iteration)
    page1 = [{"id": str(i)} for i in range(DEFAULT_PAGE_SIZE)]
    # Page 2: partial page (signals end)
    page2 = [{"id": "extra_1"}, {"id": "extra_2"}]

    mock_client = MagicMock()
    mock_client.get = MagicMock(side_effect=[page1, page2])

    result = fetch_incremental(
        dataset_key="contratos",
        last_updated_at="2025-01-01T00:00:00.000",
        client=mock_client,
    )

    assert len(result) == DEFAULT_PAGE_SIZE + 2
    assert mock_client.get.call_count == 2

    # Check that the second call used the correct offset
    second_call_kwargs = mock_client.get.call_args_list[1]
    assert second_call_kwargs.kwargs.get("offset") == DEFAULT_PAGE_SIZE


# ---------------------------------------------------------------------------
# Test 3: Empty response returns empty list
# ---------------------------------------------------------------------------

def test_fetch_incremental_empty_response(mock_app_token):
    """When Socrata returns zero rows, fetch_incremental should return
    an empty list without error."""
    mock_client = MagicMock()
    mock_client.get = MagicMock(return_value=[])

    result = fetch_incremental(
        dataset_key="contratos",
        last_updated_at="2025-06-01T00:00:00.000",
        client=mock_client,
    )

    assert result == []
    assert mock_client.get.call_count == 1


# ---------------------------------------------------------------------------
# Test 4: SoQL where clause uses correct :updated_at filter
# ---------------------------------------------------------------------------

def test_fetch_incremental_soql_where_clause(mock_app_token):
    """The SoQL $where clause must filter by :updated_at > timestamp."""
    mock_client = MagicMock()
    mock_client.get = MagicMock(return_value=[])

    timestamp = "2025-03-10T12:30:00.000"
    fetch_incremental(
        dataset_key="contratos",
        last_updated_at=timestamp,
        client=mock_client,
    )

    call_kwargs = mock_client.get.call_args.kwargs
    expected_where = f":updated_at > '{timestamp}'"
    assert call_kwargs["where"] == expected_where


# ---------------------------------------------------------------------------
# Test 5: Token is NOT in the URL (only in X-App-Token header)
# ---------------------------------------------------------------------------

def test_build_client_token_not_in_url(mock_socrata_class, mock_app_token):
    """The app token must be passed as app_token parameter (which sodapy
    sends as X-App-Token header), never as a URL query parameter.
    Verify by inspecting the Socrata constructor call: the domain argument
    must not contain the token string."""
    MockSocrata, _ = mock_socrata_class

    build_client()

    call_args = MockSocrata.call_args
    domain_arg = call_args.args[0]
    token_arg = call_args.args[1]

    # Domain must not contain the token
    assert "test-token-abc123" not in domain_arg
    # Token is the second positional arg (sodapy's app_token parameter)
    assert token_arg == "test-token-abc123"


# ---------------------------------------------------------------------------
# Test 6: Single-page response returns immediately
# ---------------------------------------------------------------------------

def test_fetch_incremental_single_page(mock_app_token):
    """When Socrata returns fewer rows than DEFAULT_PAGE_SIZE, only one
    request should be made (no unnecessary second page request)."""
    small_page = [{"id": str(i)} for i in range(100)]

    mock_client = MagicMock()
    mock_client.get = MagicMock(return_value=small_page)

    result = fetch_incremental(
        dataset_key="contratos",
        last_updated_at="2025-01-01T00:00:00.000",
        client=mock_client,
    )

    assert len(result) == 100
    assert mock_client.get.call_count == 1


# ---------------------------------------------------------------------------
# Bonus: invalid dataset key raises KeyError
# ---------------------------------------------------------------------------

def test_fetch_incremental_invalid_dataset_key(mock_app_token):
    """Passing an unknown dataset_key should raise KeyError with a helpful
    message listing the valid keys."""
    with pytest.raises(KeyError, match="Unknown dataset key"):
        fetch_incremental(
            dataset_key="nonexistent",
            last_updated_at="2025-01-01T00:00:00.000",
        )
