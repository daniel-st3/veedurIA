from __future__ import annotations

from typing import Any

import requests

from src.ingestion.votometro.normalize import (
    build_initials,
    legislator_id,
    normalize_text,
    party_key,
    slugify,
)
from src.utils.logger import get_logger

logger = get_logger(__name__)

SENATE_API_ROOT = "https://app.senado.gov.co/backend/api/public/v1"


def _fetch_json(path: str) -> list[dict[str, Any]]:
    response = requests.get(
        f"{SENATE_API_ROOT}/{path}?format=json",
        headers={"User-Agent": "VeedurIA/1.0 (+https://veeduria.vercel.app)"},
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def _normalize_social_url(network: str, raw_value: str) -> tuple[str, str]:
    raw = str(raw_value or "").strip()
    if not raw or raw.upper() == "ND":
        return "", ""
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw, raw.rsplit("/", 1)[-1]
    if network == "facebook":
        return f"https://facebook.com/{raw.lstrip('@')}", raw.lstrip("@")
    if network == "twitter":
        return f"https://x.com/{raw.lstrip('@')}", raw.lstrip("@")
    return raw, raw


def fetch_senate_payload() -> dict[str, Any]:
    senators = _fetch_json("senators")
    commissions = _fetch_json("commissions")
    votes = _fetch_json("votes")
    assistances = _fetch_json("assistances")

    commission_by_id = {
        str(entry.get("id")): str(entry.get("name") or "").strip()
        for entry in commissions
    }

    members = []
    roster_by_external_id: dict[str, dict[str, Any]] = {}
    for row in senators:
        name = str(row.get("name") or "").strip()
        if not name:
            continue
        member_id = legislator_id("senado", name)
        party = str(row.get("party_name") or "").strip()
        commission = commission_by_id.get(str(row.get("commission_id") or ""), "")
        member = {
            "id": member_id,
            "external_senate_id": str(row.get("id") or ""),
            "slug": slugify(name),
            "canonical_name": name,
            "normalized_name": normalize_text(name),
            "initials": build_initials(name),
            "chamber": "senado",
            "party": party,
            "party_key": party_key("senado", party),
            "image_url": str(row.get("image") or "").strip(),
            "source_primary": "senado/open_data",
            "source_ref": str(row.get("id") or ""),
            "source_updated_at": None,
            "term": {
                "id": f"term:{member_id}:2022-2026",
                "legislator_id": member_id,
                "period_key": "2022-2026",
                "period_label": "2022-2026",
                "role_label": "Senador(a) de la República",
                "commission": commission,
                "circunscription": "Circunscripción nacional",
                "office": "",
                "is_current": True,
                "term_start": "2022-07-20",
                "term_end": "2026-07-20",
                "source_system": "senado/open_data",
                "source_ref": str(row.get("id") or ""),
            },
            "contact": {
                "id": f"contact:{member_id}:primary",
                "legislator_id": member_id,
                "email": str(row.get("email") or "").strip(),
                "phone": str(row.get("phone") or "").strip(),
                "office": "",
                "source_system": "senado/open_data",
                "is_primary": True,
            },
            "aliases": [
                {
                    "id": f"alias:{member_id}:canonical",
                    "legislator_id": member_id,
                    "alias": name,
                    "normalized_alias": normalize_text(name),
                    "source_system": "senado/open_data",
                    "confidence": 1.0,
                    "is_canonical": True,
                }
            ],
            "socials": [],
        }

        for network in ("facebook", "twitter", "web"):
            url, handle = _normalize_social_url(network, str(row.get(network) or "").strip())
            if not url:
                continue
            member["socials"].append({
                "id": f"social:{member_id}:{network}",
                "legislator_id": member_id,
                "network": "x" if network == "twitter" else network,
                "handle": handle,
                "url": url,
                "source_system": "senado/open_data",
                "is_primary": True,
            })

        members.append(member)
        roster_by_external_id[member["external_senate_id"]] = member

    logger.info(
        "Senate payload fetched: %d members, %d votes, %d attendances",
        len(members), len(votes), len(assistances),
    )

    return {
        "members": members,
        "votes": votes,
        "assistances": assistances,
        "commissions": commissions,
        "counts": {
            "members": len(members),
            "votes": len(votes),
            "assistances": len(assistances),
        },
        "roster_by_external_id": roster_by_external_id,
    }
