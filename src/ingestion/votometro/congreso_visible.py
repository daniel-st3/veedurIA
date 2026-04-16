from __future__ import annotations

from typing import Any

from src.utils.logger import get_logger

logger = get_logger(__name__)


def fetch_backfill_payload() -> dict[str, Any]:
    """
    Placeholder adapter for Cámara / historical backfill via Congreso Visible.

    The MVP pipeline wires the backfill step into the weekly job and records a
    warning when it is still disabled, instead of silently pretending coverage
    exists. This keeps the orchestration path ready without blocking the live
    Senate + Cámara roster rollout.
    """
    logger.warning(
        "Congreso Visible backfill is not enabled in the MVP sync yet; skipping weekly enrichment step.",
    )
    return {
        "projects": [],
        "vote_events": [],
        "vote_records": [],
        "attendance_records": [],
        "warnings": ["congreso_visible_backfill_disabled"],
    }
