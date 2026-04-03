"""
Programa de Gobierno PDF scraper for VeedurIA PromesóMetro.

Downloads publicly available candidate government program PDFs from
Registraduría and party websites. Produces a manifest JSON for use by
the promise extraction pipeline.

Does NOT parse PDFs — that is promise_extractor.py's responsibility.

Usage:
    from src.ingestion.programa_scraper import scrape_programas, build_candidates_manifest

    candidates = build_candidates_manifest()
    manifest = scrape_programas(candidates, output_dir=Path("data/raw/programas"))

CLI entry point:
    python -m src.ingestion.programa_scraper --election_year=2026

Ethics note:
    This scraper fetches publicly available government documents. Never
    scrape personal data or documents behind authentication.
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

from src.utils.config import get_config
from src.utils.logger import get_logger
from src.utils.rate_limiter import get_scraper_limiter

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PROJECT_ROOT    = Path(__file__).resolve().parent.parent.parent
CANDIDATES_PATH = PROJECT_ROOT / "data" / "reference" / "candidates_2026.json"
RAW_DIR_DEFAULT = PROJECT_ROOT / "data" / "raw" / "programas"
MANIFEST_FILE   = "manifest.json"

# Retry configuration (mirrors secop_client pattern)
RETRY_BACKOFF_SECONDS: list[int] = [5, 15, 30]

_limiter = get_scraper_limiter()   # 0.2 req/s, burst=1 — same as Cuentas Claras


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def build_candidates_manifest(election_year: int | None = None) -> list[dict]:
    """
    Load candidate list from data/reference/candidates_2026.json.

    Args:
        election_year: If provided, filter candidates to this year only.

    Returns:
        List of candidate dicts with required keys:
        {politician_id, name, chamber, party, programa_url, election_year}
    """
    if not CANDIDATES_PATH.exists():
        logger.warning("Candidates file not found: %s — returning empty list.", CANDIDATES_PATH)
        return []

    with open(CANDIDATES_PATH, encoding="utf-8") as f:
        candidates: list[dict] = json.load(f)

    if election_year is not None:
        candidates = [c for c in candidates if c.get("election_year") == election_year]

    # Filter out placeholders and inactive entries
    candidates = [
        c for c in candidates
        if c.get("active", True) and c.get("programa_url", "").strip()
    ]

    logger.info("Loaded %d active candidates for year=%s", len(candidates), election_year)
    return candidates


def scrape_programas(
    candidates: list[dict],
    output_dir: Path | None = None,
    force_refresh: bool = False,
) -> list[dict]:
    """
    Download PDF government programs for each candidate.

    Args:
        candidates:    List from build_candidates_manifest().
        output_dir:    Directory to store PDFs. Defaults to data/raw/programas/.
        force_refresh: Re-download even if local PDF already exists.

    Returns:
        List of manifest entry dicts. Written to output_dir/manifest.json.
    """
    if output_dir is None:
        output_dir = RAW_DIR_DEFAULT
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest_path = output_dir / MANIFEST_FILE
    existing_manifest: list[dict] = _load_manifest(manifest_path)
    existing_ids = {e["politician_id"] for e in existing_manifest}

    new_entries: list[dict] = []

    for candidate in candidates:
        pid   = candidate["politician_id"]
        year  = candidate.get("election_year", 2026)
        url   = candidate.get("programa_url", "").strip()
        fname = f"{pid}_{year}.pdf"
        fpath = output_dir / fname

        if not url:
            logger.warning("No programa_url for %s — skipping.", pid)
            continue

        # Skip if already downloaded (unless force_refresh)
        if not force_refresh and pid in existing_ids and fpath.exists():
            logger.info("Already downloaded: %s — skipping (use --force_refresh to override).", fname)
            continue

        entry = _download_pdf(pid=pid, url=url, dest=fpath)
        new_entries.append(entry)

    # Merge with existing manifest, de-duplicate by politician_id
    combined = {e["politician_id"]: e for e in existing_manifest}
    for entry in new_entries:
        combined[entry["politician_id"]] = entry

    manifest = list(combined.values())
    _write_manifest(manifest_path, manifest)

    successful = sum(1 for e in new_entries if e.get("http_status") == 200)
    logger.info(
        "Scrape complete: %d attempted, %d successful. Manifest: %s",
        len(new_entries), successful, manifest_path,
    )
    return manifest


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _download_pdf(pid: str, url: str, dest: Path) -> dict:
    """
    Download one PDF with retry. Returns a manifest entry dict.
    Rate-limits via the module-level scraper limiter.
    """
    entry: dict[str, Any] = {
        "politician_id":   pid,
        "source_url":      url,
        "local_path":      str(dest),
        "downloaded_at":   datetime.now(timezone.utc).isoformat(),
        "file_size_bytes": 0,
        "http_status":     0,
        "error":           None,
    }

    for attempt, backoff in enumerate([0] + RETRY_BACKOFF_SECONDS, start=0):
        if backoff > 0:
            logger.info("Retry %d for %s — waiting %ds", attempt, pid, backoff)
            time.sleep(backoff)

        _limiter.acquire()

        try:
            headers = {"User-Agent": "VeedurIA/1.0 (https://github.com/veeduria; civic-transparency-bot)"}
            resp = requests.get(url, headers=headers, timeout=60, stream=True)
            entry["http_status"] = resp.status_code

            if resp.status_code == 200:
                with open(dest, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=65536):
                        if chunk:
                            f.write(chunk)
                entry["file_size_bytes"] = dest.stat().st_size
                entry["error"] = None
                logger.info(
                    "Downloaded %s → %s (%d bytes)",
                    pid, dest.name, entry["file_size_bytes"],
                )
                return entry

            # Non-200: don't retry on 4xx (client errors), retry on 5xx
            if 400 <= resp.status_code < 500:
                entry["error"] = f"HTTP {resp.status_code} — client error, not retrying"
                logger.error("HTTP %d for %s — skipping.", resp.status_code, pid)
                return entry

            entry["error"] = f"HTTP {resp.status_code}"
            logger.warning("HTTP %d for %s — will retry.", resp.status_code, pid)

        except requests.RequestException as exc:
            entry["error"] = str(exc)
            logger.warning("Request error for %s: %s — will retry.", pid, exc)

    logger.error("All retries exhausted for %s. Last error: %s", pid, entry["error"])
    return entry


def _load_manifest(path: Path) -> list[dict]:
    if path.exists():
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return []


def _write_manifest(path: Path, manifest: list[dict]) -> None:
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info("Manifest written: %s (%d entries)", path, len(manifest))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download candidate government program PDFs.")
    parser.add_argument("--election_year", type=int, default=2026)
    parser.add_argument("--force_refresh", action="store_true", default=False)
    parser.add_argument("--output_dir", type=str, default=None)
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    out = Path(args.output_dir) if args.output_dir else None
    candidates = build_candidates_manifest(election_year=args.election_year)
    if not candidates:
        print(
            f"No active candidates found for {args.election_year}. "
            f"Populate data/reference/candidates_2026.json with real candidates."
        )
    else:
        manifest = scrape_programas(
            candidates=candidates,
            output_dir=out,
            force_refresh=args.force_refresh,
        )
        print(f"Done. {len(manifest)} entries in manifest.")
