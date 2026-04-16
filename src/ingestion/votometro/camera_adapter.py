from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import requests

from src.ingestion.votometro.normalize import (
    build_initials,
    legislator_id,
    normalize_text,
    party_key,
    slugify,
)
from src.utils.config import get_optional_socrata_app_token
from src.utils.logger import get_logger
from src.utils.rate_limiter import get_secop_limiter

logger = get_logger(__name__)

CAMERA_VIEW_ID = "5pt5-nxdp"
CAMERA_VIEW_URL = f"https://www.datos.gov.co/api/views/{CAMERA_VIEW_ID}"
CAMERA_RESOURCE_URL = f"https://www.datos.gov.co/resource/{CAMERA_VIEW_ID}.json"

_limiter = get_secop_limiter()


def _headers() -> dict[str, str]:
    headers = {"User-Agent": "VeedurIA/1.0 (+https://veeduria.vercel.app)"}
    token = get_optional_socrata_app_token()
    if token:
        headers["X-App-Token"] = token
    return headers


def _build_label_map(metadata: dict[str, Any]) -> dict[str, str]:
    return {
        str(column.get("fieldName") or ""): str(column.get("name") or "")
        for column in metadata.get("columns", [])
        if column.get("fieldName")
    }


def _row_value(row: dict[str, Any], label_map: dict[str, str], *label_keywords: str) -> str:
    for field_name, label in label_map.items():
        normalized_label = normalize_text(label)
        if all(keyword in normalized_label for keyword in label_keywords):
            return str(row.get(field_name) or "").strip()
    return ""


def fetch_camera_directory(limit: int = 500) -> dict[str, Any]:
    _limiter.acquire()
    metadata_response = requests.get(CAMERA_VIEW_URL, headers=_headers(), timeout=30)
    metadata_response.raise_for_status()
    metadata = metadata_response.json()

    _limiter.acquire()
    rows_response = requests.get(
        CAMERA_RESOURCE_URL,
        headers=_headers(),
        params={"$limit": str(limit)},
        timeout=30,
    )
    rows_response.raise_for_status()
    rows = rows_response.json()

    label_map = _build_label_map(metadata)
    source_updated_at = datetime.fromtimestamp(
        int(metadata.get("rowsUpdatedAt") or 0),
        tz=timezone.utc,
    ).isoformat() if metadata.get("rowsUpdatedAt") else None

    members = []
    for row in rows:
        name = _row_value(row, label_map, "nombres") or str(row.get("_") or "").strip()
        circunscription = _row_value(row, label_map, "circunscripcion") or str(row.get("apelidos_y_nombre") or "").strip()
        party = _row_value(row, label_map, "partido") or str(row.get("partido_o_movimiento") or "").strip()
        email = _row_value(row, label_map, "correo") or str(row.get("circunscripcion") or "").strip()
        office = _row_value(row, label_map, "oficina") or str(row.get("comision_const") or "").strip()
        phone = _row_value(row, label_map, "extension") or _row_value(row, label_map, "telefono") or str(row.get("comision_legal") or "").strip()

        if not name:
            continue

        member_id = legislator_id("camara", name)
        members.append({
            "id": member_id,
            "slug": slugify(name),
            "canonical_name": name,
            "normalized_name": normalize_text(name),
            "initials": build_initials(name),
            "chamber": "camara",
            "party": party,
            "party_key": party_key("camara", party),
            "source_primary": "datos.gov.co/camara",
            "source_ref": CAMERA_VIEW_ID,
            "source_updated_at": source_updated_at,
            "term": {
                "id": f"term:{member_id}:2022-2026",
                "legislator_id": member_id,
                "period_key": "2022-2026",
                "period_label": "2022-2026",
                "role_label": "Representante a la Cámara",
                "commission": "",
                "circunscription": circunscription,
                "office": office,
                "is_current": True,
                "term_start": "2022-07-20",
                "term_end": "2026-07-20",
                "source_system": "datos.gov.co/camara",
                "source_ref": CAMERA_VIEW_ID,
            },
            "contact": {
                "id": f"contact:{member_id}:primary",
                "legislator_id": member_id,
                "email": email,
                "phone": phone,
                "office": office,
                "source_system": "datos.gov.co/camara",
                "is_primary": True,
            },
            "aliases": [
                {
                    "id": f"alias:{member_id}:canonical",
                    "legislator_id": member_id,
                    "alias": name,
                    "normalized_alias": normalize_text(name),
                    "source_system": "datos.gov.co/camara",
                    "confidence": 1.0,
                    "is_canonical": True,
                }
            ],
        })

    logger.info("Camera directory fetched: %d members", len(members))
    return {
        "members": members,
        "metadata": metadata,
        "rows": rows,
        "counts": {"members": len(members)},
    }
