"""
FastAPI entrypoint for the VeedurIA web frontend.
"""

from __future__ import annotations

import os
from typing import Literal

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from src.api.contracts_service import (
    get_overview_payload,
    get_table_payload,
    load_geojson,
)
from src.api.promises_service import get_promises_payload

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
    election_year: int = Query(2026, ge=2024, le=2030),
    query: str | None = None,
    limit: int = Query(18, ge=1, le=40),
) -> dict:
    return get_promises_payload(
        lang=lang,
        politician_id=politician_id,
        domain=domain,
        status=status,
        election_year=election_year,
        query=query,
        limit=limit,
    )
