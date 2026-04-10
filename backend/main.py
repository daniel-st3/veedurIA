"""
FastAPI entrypoint for the VeedurIA web frontend.
"""

from __future__ import annotations

import os
from typing import Any, Literal

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.api.contracts_service import (
    get_freshness_payload,
    get_overview_payload,
    get_table_payload,
    load_geojson,
)
from src.api.promises_service import get_promises_payload
from src.api.network_service import (
    get_overview_payload as get_network_overview,
    get_search_payload as get_network_search,
    get_expand_payload as get_network_expand,
    get_node_detail_payload as get_network_node_detail,
    get_version_payload as get_network_version,
    record_error_report,
)

app = FastAPI(title="VeedurIA API", version="0.1.0")

cors_origins = os.getenv(
    "VEEDURIA_CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/contracts/geojson")
def contracts_geojson() -> dict:
    return load_geojson()


@app.get("/contracts/overview")
def contracts_overview(
    lang: Literal["es", "en"] = "es",
    full: bool = False,
    department: str | None = None,
    risk: Literal["all", "high", "medium", "low"] = "all",
    modality: str | None = None,
    query: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = Query(6, ge=1, le=12),
) -> dict:
    return get_overview_payload(
        lang=lang,
        full=full,
        department=department,
        risk=risk,
        modality=modality,
        query=query,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )


@app.get("/contracts/freshness")
def contracts_freshness() -> dict:
    return get_freshness_payload()


@app.get("/contracts/table")
def contracts_table(
    lang: Literal["es", "en"] = "es",
    full: bool = False,
    department: str | None = None,
    risk: Literal["all", "high", "medium", "low"] = "all",
    modality: str | None = None,
    query: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=100),
) -> dict:
    return get_table_payload(
        lang=lang,
        full=full,
        department=department,
        risk=risk,
        modality=modality,
        query=query,
        date_from=date_from,
        date_to=date_to,
        offset=offset,
        limit=limit,
    )


@app.get("/promises/overview")
def promises_overview(
    lang: Literal["es", "en"] = "es",
    politician_id: str | None = None,
    domain: str = "all",
    status: str = "all",
    election_year: int = Query(2022, ge=2022, le=2030),
    chamber: str | None = None,
    query: str | None = None,
    limit: int = Query(48, ge=1, le=120),
) -> dict:
    return get_promises_payload(
        lang=lang,
        politician_id=politician_id,
        domain=domain,
        status=status,
        election_year=election_year,
        chamber=chamber,
        query=query,
        limit=limit,
    )


# ---------------------------------------------------------------------------
# SigueElDinero — Network endpoints
# ---------------------------------------------------------------------------

@app.get("/network/version")
def network_version() -> dict:
    """Return current graph version and build metadata."""
    return get_network_version()


@app.get("/network/overview")
def network_overview(
    lang: Literal["es", "en"] = "es",
    limit: int = Query(30, ge=5, le=50),
    department: str | None = None,
    min_confidence: int = Query(40, ge=0, le=100),
) -> dict:
    """
    Return top hub entity nodes + their connected providers.
    Initial view for the network canvas.
    """
    return get_network_overview(
        lang=lang,
        limit=limit,
        department=department or None,
        min_confidence=min_confidence,
    )


@app.get("/network/search")
def network_search(
    q: str = Query(..., min_length=2, max_length=200),
    lang: Literal["es", "en"] = "es",
    min_confidence: int = Query(40, ge=0, le=100),
) -> dict:
    """
    Return ego-network for the best matching entity/provider.
    """
    return get_network_search(query=q, lang=lang, min_confidence=min_confidence)


@app.get("/network/expand/{node_id}")
def network_expand(
    node_id: str,
    lang: Literal["es", "en"] = "es",
    min_confidence: int = Query(40, ge=0, le=100),
) -> dict:
    """
    Return next-level neighbors for a given node (up to 15 new nodes).
    """
    return get_network_expand(node_id=node_id, lang=lang, min_confidence=min_confidence)


@app.get("/network/node/{node_id}")
def network_node_detail(
    node_id: str,
    lang: Literal["es", "en"] = "es",
) -> dict:
    """
    Return full stats for a single node (for the right panel).
    """
    return get_network_node_detail(node_id=node_id, lang=lang)


class ErrorReportBody(BaseModel):
    edge_id: str | None = None
    node_id: str | None = None
    description: str = ""
    reporter_email: str | None = None


@app.post("/network/report-error")
def network_report_error(body: ErrorReportBody) -> dict[str, str]:
    """
    Accept a user-submitted error report for a node or edge relationship.
    Stored in data/processed/error_reports.jsonl (append-only).
    """
    record_error_report(body.model_dump())
    return {"status": "received"}
