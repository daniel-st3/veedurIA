from __future__ import annotations

import argparse
import json
from collections import defaultdict
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any, Iterable

from supabase import Client, create_client

from src.ingestion.votometro.camera_adapter import fetch_camera_directory
from src.ingestion.votometro.congreso_visible import fetch_backfill_payload
from src.ingestion.votometro.normalize import (
    classify_topic,
    find_best_name_match,
    normalize_text,
    party_key,
    stable_id,
    topic_label,
)
from src.ingestion.votometro.senate_adapter import fetch_senate_payload
from src.utils.config import (
    get_supabase_key,
    get_supabase_url,
    get_votometro_storage_bucket,
)
from src.utils.logger import get_logger, log_etl_event

logger = get_logger(__name__)
BATCH_SIZE = 500


def _supabase() -> Client:
    return create_client(get_supabase_url(), get_supabase_key())


def _jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(v) for v in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if hasattr(value, "item"):
        return value.item()
    return str(value)


def _chunked(rows: list[dict[str, Any]], size: int = BATCH_SIZE) -> Iterable[list[dict[str, Any]]]:
    for index in range(0, len(rows), size):
        yield rows[index:index + size]


def _upload_snapshot(client: Client, source: str, payload: dict[str, Any]) -> str | None:
    try:
        bucket = get_votometro_storage_bucket()
        now = datetime.now(timezone.utc)
        body = json.dumps(payload, ensure_ascii=False, default=_jsonable).encode("utf-8")
        digest = sha256(body).hexdigest()[:20]
        remote_path = f"{source}/{now:%Y/%m/%d}/{digest}.json"
        client.storage.from_(bucket).upload(
            remote_path,
            body,
            file_options={"content-type": "application/json"},
        )
        log_etl_event("votometro_snapshot_uploaded", bucket=bucket, remote_path=remote_path, size_bytes=len(body))
        return remote_path
    except Exception as exc:  # pragma: no cover - network/storage dependent
        logger.warning("Snapshot upload failed for %s: %s", source, exc)
        log_etl_event("votometro_snapshot_upload_failed", source=source, error=str(exc))
        return None


def _upsert_rows(client: Client, table: str, rows: list[dict[str, Any]], on_conflict: str) -> int:
    if not rows:
        return 0
    done = 0
    for batch in _chunked([{k: _jsonable(v) for k, v in row.items()} for row in rows]):
        client.table(table).upsert(batch, on_conflict=on_conflict).execute()
        done += len(batch)
    return done


def _load_current_counts(client: Client) -> dict[str, int]:
    legislators_count = client.table("legislators").select("id", count="exact").eq("active", True).limit(1).execute().count or 0
    vote_count = client.table("vote_records").select("id", count="exact").limit(1).execute().count or 0
    return {"legislators": legislators_count, "vote_records": vote_count}


def _load_approved_match_map(client: Client) -> dict[tuple[str, str], list[str]]:
    reviews = client.table("promise_reviews").select("promise_claim_id, status").eq("status", "approved").limit(5000).execute().data or []
    approved_claim_ids = {str(row["promise_claim_id"]) for row in reviews}
    if not approved_claim_ids:
        return {}

    matches = client.table("promise_vote_matches").select("promise_claim_id, vote_event_id, legislator_id, coherence_status").limit(5000).execute().data or []
    result: dict[tuple[str, str], list[str]] = defaultdict(list)
    for row in matches:
        promise_claim_id = str(row.get("promise_claim_id") or "")
        if promise_claim_id not in approved_claim_ids:
            continue
        key = (str(row.get("legislator_id") or ""), str(row.get("vote_event_id") or ""))
        result[key].append(str(row.get("coherence_status") or "pending"))
    return result


def _build_senate_activity(
    senate_payload: dict[str, Any],
    legislators: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    legislators_by_external_id = senate_payload["roster_by_external_id"]
    senate_legislators = [row for row in legislators if row["chamber"] == "senado"]
    warnings: list[str] = []

    projects: dict[str, dict[str, Any]] = {}
    vote_events: dict[str, dict[str, Any]] = {}
    vote_records: dict[str, dict[str, Any]] = {}
    attendance_records: dict[str, dict[str, Any]] = {}

    for vote in senate_payload["votes"]:
        external_senate_id = str(vote.get("senator_id") or "")
        member = legislators_by_external_id.get(external_senate_id)
        if member is None:
            member = find_best_name_match(
                str(vote.get("senator_name") or ""),
                senate_legislators,
                chamber="senado",
            )
        if member is None:
            warnings.append(f"missing_senator_match:{vote.get('senator_name')}")
            continue

        project_name = str(vote.get("project_name") or "").strip() or "Proyecto sin título visible"
        external_project_id = str(vote.get("project_id") or "").strip()
        project_id = f"project:senado:{external_project_id or stable_id('project', project_name)}"
        topic_key = classify_topic(project_name)
        projects[project_id] = {
            "id": project_id,
            "external_id": external_project_id,
            "title": project_name,
            "normalized_title": normalize_text(project_name),
            "description": "",
            "chamber": "senado",
            "topic_key": topic_key,
            "topic_label": topic_label(topic_key),
            "status": "",
            "filed_at": None,
            "source_system": "senado/open_data",
            "source_url": "https://app.senado.gov.co/open_data/",
            "metadata": {
                "project_id": external_project_id,
            },
        }

        event_id = f"vote-event:senado:{vote.get('plenary_id')}:{external_project_id or stable_id('vote-event', project_name, str(vote.get('created_at') or ''))}"
        vote_events[event_id] = {
            "id": event_id,
            "external_id": str(vote.get("plenary_id") or ""),
            "project_id": project_id,
            "chamber": "senado",
            "vote_date": str(vote.get("created_at") or "")[:10],
            "session_label": f"Plenaria {vote.get('plenary_id')}",
            "result_text": "",
            "source_system": "senado/open_data",
            "source_url": "https://app.senado.gov.co/open_data/",
            "metadata": {
                "project_name": project_name,
            },
        }

        raw_vote = str(vote.get("vote") or "").strip()
        normalized_vote = "Sí" if normalize_text(raw_vote) == "si" else raw_vote or "Sin dato"
        record_id = f"vote-record:{event_id}:{member['id']}"
        vote_records[record_id] = {
            "id": record_id,
            "vote_event_id": event_id,
            "legislator_id": member["id"],
            "project_id": project_id,
            "chamber": "senado",
            "vote_date": str(vote.get("created_at") or "")[:10],
            "vote_value": normalized_vote,
            "is_absent": normalize_text(raw_vote) in {"ausente", "no asiste"},
            "deviates_from_party": False,
            "source_system": "senado/open_data",
            "source_url": "https://app.senado.gov.co/open_data/",
            "metadata": {
                "senator_external_id": external_senate_id,
                "senator_name": str(vote.get("senator_name") or ""),
            },
        }

    for attendance in senate_payload["assistances"]:
        external_senate_id = str(attendance.get("senator_id") or "")
        member = legislators_by_external_id.get(external_senate_id)
        if member is None:
            member = find_best_name_match(
                str(attendance.get("senator") or ""),
                senate_legislators,
                chamber="senado",
            )
        if member is None:
            warnings.append(f"missing_attendance_match:{attendance.get('senator')}")
            continue

        record_id = f"attendance:senado:{attendance.get('plenary_id')}:{member['id']}"
        attendance_records[record_id] = {
            "id": record_id,
            "legislator_id": member["id"],
            "chamber": "senado",
            "session_external_id": str(attendance.get("plenary_id") or ""),
            "attendance_date": str(attendance.get("plenary_created_at") or "")[:10],
            "attended": normalize_text(str(attendance.get("attended") or "")) == "si",
            "source_system": "senado/open_data",
            "source_url": "https://app.senado.gov.co/open_data/",
            "metadata": {
                "senator_external_id": external_senate_id,
                "senator_name": str(attendance.get("senator") or ""),
            },
        }

    return (
        list(projects.values()),
        list(vote_events.values()),
        list(vote_records.values()),
        list(attendance_records.values()),
        sorted(set(warnings)),
    )


def _build_metrics(
    legislators: list[dict[str, Any]],
    projects: list[dict[str, Any]],
    vote_records: list[dict[str, Any]],
    attendance_records: list[dict[str, Any]],
    approved_match_map: dict[tuple[str, str], list[str]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    project_topic = {row["id"]: (row.get("topic_key") or "sin-clasificar", row.get("topic_label") or "Sin clasificar") for row in projects}
    votes_by_legislator: dict[str, list[dict[str, Any]]] = defaultdict(list)
    attendance_by_legislator: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for row in vote_records:
        votes_by_legislator[str(row["legislator_id"])].append(row)
    for row in attendance_records:
        attendance_by_legislator[str(row["legislator_id"])].append(row)

    metric_rows: list[dict[str, Any]] = []
    party_groups: dict[str, dict[str, Any]] = defaultdict(lambda: {
        "party": "",
        "chamber": "",
        "member_count": 0,
        "active_members": 0,
        "indexed_votes": 0,
        "attendance_values": [],
        "coherence_values": [],
        "approved_promise_matches": 0,
        "topic_scores": defaultdict(lambda: {"key": "", "label": "", "score_values": [], "votes": 0}),
    })

    for legislator in legislators:
        legislator_id = str(legislator["id"])
        chamber = str(legislator["chamber"])
        votes = votes_by_legislator.get(legislator_id, [])
        attendances = attendance_by_legislator.get(legislator_id, [])

        coherent_votes = 0
        inconsistent_votes = 0
        absent_votes = 0
        topic_rows: dict[str, dict[str, Any]] = defaultdict(lambda: {"key": "", "label": "", "votes": 0, "score_values": []})
        approved_match_count = 0

        for vote in votes:
            topic_key, topic_name = project_topic.get(str(vote.get("project_id") or ""), ("sin-clasificar", "Sin clasificar"))
            topic_rows[topic_key]["key"] = topic_key
            topic_rows[topic_key]["label"] = topic_name
            topic_rows[topic_key]["votes"] += 1

            match_statuses = approved_match_map.get((legislator_id, str(vote["vote_event_id"])), [])
            if not match_statuses:
                continue

            approved_match_count += len(match_statuses)
            for status in match_statuses:
                if status == "coherent":
                    coherent_votes += 1
                    topic_rows[topic_key]["score_values"].append(1)
                elif status == "inconsistent":
                    inconsistent_votes += 1
                    topic_rows[topic_key]["score_values"].append(0)
                elif status == "absent":
                    absent_votes += 1

        topic_scores = []
        for row in topic_rows.values():
            score_values = row["score_values"]
            topic_scores.append({
                "key": row["key"],
                "label": row["label"],
                "score": round(sum(score_values) / len(score_values) * 100, 1) if score_values else None,
                "votes": row["votes"],
            })
        topic_scores.sort(key=lambda row: (-row["votes"], row["label"]))
        top_topics = [row["label"] for row in topic_scores[:3]]

        attendance_sessions = len(attendances)
        attended_sessions = sum(1 for row in attendances if row.get("attended"))
        attendance_rate = round(attended_sessions / attendance_sessions * 100, 1) if attendance_sessions else None
        coherence_score = round(coherent_votes / (coherent_votes + inconsistent_votes) * 100, 1) if (coherent_votes + inconsistent_votes) else None

        metric_rows.append({
            "legislator_id": legislator_id,
            "chamber": chamber,
            "party": legislator.get("party") or "",
            "party_key": legislator.get("party_key") or party_key(chamber, legislator.get("party")),
            "period_key": "2022-2026",
            "votes_indexed": len(votes),
            "attendance_sessions": attendance_sessions,
            "attended_sessions": attended_sessions,
            "attendance_rate": attendance_rate,
            "approved_promise_matches": approved_match_count,
            "coherent_votes": coherent_votes,
            "inconsistent_votes": inconsistent_votes,
            "absent_votes": absent_votes,
            "coherence_score": coherence_score,
            "top_topics": top_topics,
            "topic_scores": topic_scores,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })

        group = party_groups[str(legislator.get("party_key") or "")]
        group["party"] = legislator.get("party") or ""
        group["chamber"] = chamber
        group["member_count"] += 1
        group["active_members"] += 1 if legislator.get("active", True) else 0
        group["indexed_votes"] += len(votes)
        group["approved_promise_matches"] += approved_match_count
        if attendance_rate is not None:
            group["attendance_values"].append(attendance_rate)
        if coherence_score is not None:
            group["coherence_values"].append(coherence_score)
        for row in topic_scores:
            party_topic = group["topic_scores"][row["key"]]
            party_topic["key"] = row["key"]
            party_topic["label"] = row["label"]
            party_topic["votes"] += row["votes"]
            if row["score"] is not None:
                party_topic["score_values"].append(row["score"])

    party_rows = []
    for key, group in party_groups.items():
        topic_scores = []
        for row in group["topic_scores"].values():
            topic_scores.append({
                "key": row["key"],
                "label": row["label"],
                "votes": row["votes"],
                "score": round(sum(row["score_values"]) / len(row["score_values"]), 1) if row["score_values"] else None,
            })
        topic_scores.sort(key=lambda row: (-row["votes"], row["label"]))
        party_rows.append({
            "party_key": key,
            "party": group["party"] or "Sin partido visible",
            "chamber": group["chamber"],
            "member_count": group["member_count"],
            "active_members": group["active_members"],
            "indexed_votes": group["indexed_votes"],
            "attendance_rate": round(sum(group["attendance_values"]) / len(group["attendance_values"]), 1) if group["attendance_values"] else None,
            "coherence_score": round(sum(group["coherence_values"]) / len(group["coherence_values"]), 1) if group["coherence_values"] else None,
            "approved_promise_matches": group["approved_promise_matches"],
            "topic_scores": topic_scores,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })

    return metric_rows, party_rows


def _mark_stale_legislators_inactive(client: Client, live_ids: set[str]) -> None:
    current_rows = client.table("legislators").select("id").eq("active", True).limit(1000).execute().data or []
    stale_ids = [str(row["id"]) for row in current_rows if str(row["id"]) not in live_ids]
    for stale_id in stale_ids:
        client.table("legislators").update({"active": False, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", stale_id).execute()


def run_sync(mode: str = "daily") -> dict[str, Any]:
    client = _supabase()
    run_id = f"votometro:{mode}:{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    started_at = datetime.now(timezone.utc).isoformat()

    camera_payload = fetch_camera_directory()
    senate_payload = fetch_senate_payload()
    backfill_payload = fetch_backfill_payload() if mode == "weekly" else {"projects": [], "vote_events": [], "vote_records": [], "attendance_records": [], "warnings": []}

    legislators: list[dict[str, Any]] = []
    terms: list[dict[str, Any]] = []
    aliases: list[dict[str, Any]] = []
    contacts: list[dict[str, Any]] = []
    socials: list[dict[str, Any]] = []

    for source_payload in (camera_payload["members"], senate_payload["members"]):
        for member in source_payload:
            legislators.append({
                "id": member["id"],
                "slug": member["slug"],
                "canonical_name": member["canonical_name"],
                "normalized_name": member["normalized_name"],
                "initials": member["initials"],
                "chamber": member["chamber"],
                "party": member.get("party") or "",
                "party_key": member.get("party_key") or party_key(member["chamber"], member.get("party")),
                "image_url": member.get("image_url") or "",
                "bio": member.get("bio") or "",
                "source_primary": member["source_primary"],
                "source_ref": member.get("source_ref") or "",
                "source_updated_at": member.get("source_updated_at"),
                "active": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            terms.append(member["term"])
            contacts.append(member["contact"])
            aliases.extend(member.get("aliases", []))
            socials.extend(member.get("socials", []))

    projects, vote_events, vote_records, attendance_records, senate_warnings = _build_senate_activity(senate_payload, legislators)
    projects.extend(backfill_payload["projects"])
    vote_events.extend(backfill_payload["vote_events"])
    vote_records.extend(backfill_payload["vote_records"])
    attendance_records.extend(backfill_payload["attendance_records"])

    approved_match_map = _load_approved_match_map(client)
    metric_rows, party_rows = _build_metrics(
        legislators,
        projects,
        vote_records,
        attendance_records,
        approved_match_map,
    )

    warnings = sorted(set(senate_warnings + backfill_payload["warnings"]))
    live_counts = {
        "legislators": len(legislators),
        "vote_records": len(vote_records),
        "attendance_records": len(attendance_records),
        "projects": len(projects),
    }
    previous_counts = _load_current_counts(client)

    if previous_counts["legislators"] and live_counts["legislators"] < previous_counts["legislators"] * 0.9:
        warnings.append("live_legislator_count_drop_gt_10pct")
    if previous_counts["vote_records"] and live_counts["vote_records"] < previous_counts["vote_records"] * 0.9:
        warnings.append("live_vote_count_drop_gt_10pct")

    snapshot_paths = {
        "camera": _upload_snapshot(client, "datos-gov-camara", {
            "metadata": camera_payload["metadata"],
            "rows": camera_payload["rows"],
            "counts": camera_payload["counts"],
        }),
        "senate": _upload_snapshot(client, "senado-open-data", {
            "counts": senate_payload["counts"],
            "members": senate_payload["members"],
            "votes": senate_payload["votes"],
            "assistances": senate_payload["assistances"],
        }),
    }

    status = "warning" if warnings else "success"
    replace_public = status == "success"
    rows_out = 0

    if replace_public:
        _upsert_rows(client, "legislators", legislators, on_conflict="id")
        _upsert_rows(client, "legislator_terms", terms, on_conflict="id")
        _upsert_rows(client, "legislator_aliases", aliases, on_conflict="id")
        _upsert_rows(client, "legislator_contacts", contacts, on_conflict="id")
        _upsert_rows(client, "legislator_socials", socials, on_conflict="id")
        _upsert_rows(client, "projects", projects, on_conflict="id")
        _upsert_rows(client, "vote_events", vote_events, on_conflict="id")
        _upsert_rows(client, "vote_records", vote_records, on_conflict="id")
        _upsert_rows(client, "attendance_records", attendance_records, on_conflict="id")
        _upsert_rows(client, "legislator_metrics_current", metric_rows, on_conflict="legislator_id")
        rows_out = _upsert_rows(client, "party_metrics_current", party_rows, on_conflict="party_key")
        _mark_stale_legislators_inactive(client, {row["id"] for row in legislators})

    finished_at = datetime.now(timezone.utc).isoformat()
    run_row = {
        "id": run_id,
        "job_name": "votometro_sync",
        "mode": mode,
        "source_system": "datos.gov.co + senado/open_data",
        "status": status,
        "started_at": started_at,
        "finished_at": finished_at,
        "rows_in": live_counts["legislators"] + live_counts["vote_records"] + live_counts["attendance_records"],
        "rows_out": rows_out,
        "replace_public": replace_public,
        "snapshot_path": json.dumps(snapshot_paths, ensure_ascii=False),
        "deltas": {
            "previous": previous_counts,
            "current": live_counts,
        },
        "warnings": warnings,
        "metadata": {
            "projects": len(projects),
            "metric_rows": len(metric_rows),
            "party_rows": len(party_rows),
        },
    }
    client.table("ingestion_runs").upsert(run_row, on_conflict="id").execute()

    log_etl_event(
        "votometro_sync_complete",
        mode=mode,
        status=status,
        live_counts=live_counts,
        previous_counts=previous_counts,
        warnings=warnings,
        replace_public=replace_public,
    )
    return run_row


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync VotóMeter live coverage into Supabase.")
    parser.add_argument("--mode", choices=("daily", "weekly"), default="daily")
    args = parser.parse_args()
    result = run_sync(mode=args.mode)
    logger.info("Votómetro sync finished with status=%s", result["status"])


if __name__ == "__main__":
    main()
