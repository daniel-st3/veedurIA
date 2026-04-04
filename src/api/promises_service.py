"""
Promise coherence API service for the Next.js VeedurIA frontend.

This service reads Phase 2 / PromesMetro artifacts and exposes a single payload
optimized for the web product shell. When the full promises/actions pipeline is
not available yet, it falls back to an explicit pilot dataset so the Next.js
product stays coherent while real coverage is completed.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
PROMISES_DIR = PROJECT_ROOT / "data" / "processed" / "promises"
REFERENCE_DIR = PROJECT_ROOT / "data" / "reference"

COHERENCE_PATH = PROMISES_DIR / "coherence.parquet"
PROMISES_PATH = PROMISES_DIR / "promises.parquet"
ACTIONS_PATH = PROMISES_DIR / "actions.parquet"
CANDIDATES_PATH = REFERENCE_DIR / "candidates_2026.json"

DOMAIN_ORDER = [
    "educacion",
    "salud",
    "seguridad",
    "economia",
    "infraestructura",
    "medio_ambiente",
    "justicia",
    "social",
    "otro",
]

DOMAIN_LABELS = {
    "es": {
        "educacion": "Educacion",
        "salud": "Salud",
        "seguridad": "Seguridad",
        "economia": "Economia",
        "infraestructura": "Infraestructura",
        "medio_ambiente": "Medio ambiente",
        "justicia": "Justicia",
        "social": "Social",
        "otro": "Otro",
    },
    "en": {
        "educacion": "Education",
        "salud": "Health",
        "seguridad": "Security",
        "economia": "Economy",
        "infraestructura": "Infrastructure",
        "medio_ambiente": "Environment",
        "justicia": "Justice",
        "social": "Social",
        "otro": "Other",
    },
}

STATUS_LABELS = {
    "es": {
        "all": "Todos",
        "con_accion_registrada": "Con accion registrada",
        "en_seguimiento": "En seguimiento",
        "sin_accion_registrada": "Sin evidencia disponible",
    },
    "en": {
        "all": "All",
        "con_accion_registrada": "With registered action",
        "en_seguimiento": "Under monitoring",
        "sin_accion_registrada": "No evidence available",
    },
}

POLITICIAN_FALLBACKS = {
    "pol_001": {
        "politician_name": "Iván Cepeda",
        "chamber": "Presidencia 2022",
        "party": "Pacto Histórico",
    },
    "pol_002": {
        "politician_name": "Paloma Valencia",
        "chamber": "Presidencia 2022",
        "party": "Centro Democrático",
    },
    "pol_003": {
        "politician_name": "Sergio Fajardo",
        "chamber": "Presidencia 2022",
        "party": "Centro",
    },
}

DEMO_ROWS: list[dict[str, Any]] = [
    {
        "coherence_id": "demo_001",
        "promise_id": "p_demo_001",
        "action_id": "a_demo_001",
        "politician_id": "pol_001",
        "politician_name": "Iván Cepeda",
        "chamber": "Presidencia 2022",
        "party": "Pacto Histórico",
        "domain": "educacion",
        "promise_text": "Ampliaremos la jornada escolar rural con conectividad y formacion docente en municipios intermedios.",
        "promise_source_url": "https://www.registraduria.gov.co/",
        "promise_source_label": "Programa de gobierno",
        "action_title": "Proyecto de ley de conectividad educativa territorial",
        "action_summary": "Iniciativa radicada para ampliar conectividad escolar y soporte docente en territorios rurales.",
        "action_date": "2022-02-14",
        "action_source_url": "https://www.secretariasenado.gov.co/senado/basedoc/",
        "action_source_system": "Congreso",
        "similarity_score": 0.81,
        "status": "con_accion_registrada",
        "status_confidence": 0.84,
        "politician_coherence_score": 0.67,
        "evidence_snippet": "Texto legislativo asociado a conectividad escolar y despliegue docente regional.",
        "election_year": 2022,
        "scored_at": "2022-04-03T13:00:05+00:00",
        "extraction_confidence": 0.86,
        "domain_confidence": 0.79,
    },
    {
        "coherence_id": "demo_002",
        "promise_id": "p_demo_002",
        "action_id": "a_demo_002",
        "politician_id": "pol_001",
        "politician_name": "Iván Cepeda",
        "chamber": "Presidencia 2022",
        "party": "Pacto Histórico",
        "domain": "salud",
        "promise_text": "Reduciremos tiempos de autorizacion en la red publica con una ventanilla digital unica de atencion.",
        "promise_source_url": "https://www.registraduria.gov.co/",
        "promise_source_label": "Discurso territorial",
        "action_title": "Audiencia de control politico sobre tiempos de autorizacion en EPS",
        "action_summary": "Debate de control con seguimiento a autorizaciones y gestion de filas en prestadores publicos.",
        "action_date": "2022-03-02",
        "action_source_url": "https://www.imprenta.gov.co/gacetap/gaceta.indice",
        "action_source_system": "Gaceta",
        "similarity_score": 0.58,
        "status": "en_seguimiento",
        "status_confidence": 0.49,
        "politician_coherence_score": 0.67,
        "evidence_snippet": "La evidencia encontrada apunta a seguimiento politico, no todavia a ejecucion completa.",
        "election_year": 2022,
        "scored_at": "2022-04-03T13:00:05+00:00",
        "extraction_confidence": 0.82,
        "domain_confidence": 0.75,
    },
    {
        "coherence_id": "demo_003",
        "promise_id": "p_demo_003",
        "action_id": "NONE",
        "politician_id": "pol_001",
        "politician_name": "Iván Cepeda",
        "chamber": "Presidencia 2022",
        "party": "Pacto Histórico",
        "domain": "seguridad",
        "promise_text": "Desplegaremos una estrategia de seguridad barrial con analitica urbana y patrullaje coordinado.",
        "promise_source_url": "https://www.registraduria.gov.co/",
        "promise_source_label": "Programa de gobierno",
        "action_title": "Sin evidencia enlazada",
        "action_summary": "Aun no hay accion legislativa o ejecutiva suficientemente cercana en la cobertura disponible.",
        "action_date": "",
        "action_source_url": "https://www.registraduria.gov.co/",
        "action_source_system": "Cobertura",
        "similarity_score": 0.18,
        "status": "sin_accion_registrada",
        "status_confidence": 0.72,
        "politician_coherence_score": 0.67,
        "evidence_snippet": "Sin cobertura accionable en esta corrida piloto.",
        "election_year": 2022,
        "scored_at": "2022-04-03T13:00:05+00:00",
        "extraction_confidence": 0.8,
        "domain_confidence": 0.7,
    },
    {
        "coherence_id": "demo_004",
        "promise_id": "p_demo_004",
        "action_id": "a_demo_004",
        "politician_id": "pol_002",
        "politician_name": "Paloma Valencia",
        "chamber": "Presidencia 2022",
        "party": "Centro Democrático",
        "domain": "economia",
        "promise_text": "Impulsaremos compras publicas abiertas para mipymes locales con trazabilidad digital en tiempo real.",
        "promise_source_url": "https://www.registraduria.gov.co/",
        "promise_source_label": "Programa de gobierno",
        "action_title": "Ponencia sobre apertura de compras publicas para mipymes",
        "action_summary": "Documento radicado con ajustes a reglas de compras y trazabilidad para proveedores locales.",
        "action_date": "2022-02-28",
        "action_source_url": "https://www.secretariasenado.gov.co/senado/basedoc/",
        "action_source_system": "Congreso",
        "similarity_score": 0.77,
        "status": "con_accion_registrada",
        "status_confidence": 0.73,
        "politician_coherence_score": 0.61,
        "evidence_snippet": "Se encontro una accion normativa directamente conectada a trazabilidad y compras locales.",
        "election_year": 2022,
        "scored_at": "2022-04-03T13:00:05+00:00",
        "extraction_confidence": 0.83,
        "domain_confidence": 0.81,
    },
    {
        "coherence_id": "demo_005",
        "promise_id": "p_demo_005",
        "action_id": "a_demo_005",
        "politician_id": "pol_002",
        "politician_name": "Paloma Valencia",
        "chamber": "Presidencia 2022",
        "party": "Centro Democrático",
        "domain": "justicia",
        "promise_text": "Crearemos un tablero publico para seguimiento de sanciones por contratacion y conflicto de interes.",
        "promise_source_url": "https://www.registraduria.gov.co/",
        "promise_source_label": "Foro programatico",
        "action_title": "Debate de control sobre transparencia contractual",
        "action_summary": "Sesion dedicada a trazabilidad, conflictos de interes y reportes publicos de sanciones.",
        "action_date": "2022-03-08",
        "action_source_url": "https://www.imprenta.gov.co/gacetap/gaceta.indice",
        "action_source_system": "Gaceta",
        "similarity_score": 0.53,
        "status": "en_seguimiento",
        "status_confidence": 0.34,
        "politician_coherence_score": 0.61,
        "evidence_snippet": "La similitud existe, pero la accion sigue siendo parcial frente a la promesa completa.",
        "election_year": 2022,
        "scored_at": "2022-04-03T13:00:05+00:00",
        "extraction_confidence": 0.78,
        "domain_confidence": 0.76,
    },
    {
        "coherence_id": "demo_006",
        "promise_id": "p_demo_006",
        "action_id": "NONE",
        "politician_id": "pol_002",
        "politician_name": "Paloma Valencia",
        "chamber": "Presidencia 2022",
        "party": "Centro Democrático",
        "domain": "medio_ambiente",
        "promise_text": "Frenaremos la deforestacion en corredores amazónicos con compras publicas libres de tala.",
        "promise_source_url": "https://www.registraduria.gov.co/",
        "promise_source_label": "Programa de gobierno",
        "action_title": "Sin evidencia enlazada",
        "action_summary": "La corrida piloto no encontro evidencia legislativa suficientemente cercana para enlazarla.",
        "action_date": "",
        "action_source_url": "https://www.registraduria.gov.co/",
        "action_source_system": "Cobertura",
        "similarity_score": 0.2,
        "status": "sin_accion_registrada",
        "status_confidence": 0.69,
        "politician_coherence_score": 0.61,
        "evidence_snippet": "Sin evidencia util en la cobertura actual de la fase.",
        "election_year": 2022,
        "scored_at": "2022-04-03T13:00:05+00:00",
        "extraction_confidence": 0.81,
        "domain_confidence": 0.74,
    },
    {
        "coherence_id": "demo_007",
        "promise_id": "p_demo_007",
        "action_id": "a_demo_007",
        "politician_id": "pol_003",
        "politician_name": "Sergio Fajardo",
        "chamber": "Presidencia 2022",
        "party": "Centro",
        "domain": "infraestructura",
        "promise_text": "Priorizaremos mantenimiento de vias secundarias con control social y tableros de obra abiertos.",
        "promise_source_url": "https://www.registraduria.gov.co/",
        "promise_source_label": "Programa de gobierno",
        "action_title": "Proposicion sobre mantenimiento vial regional y tableros abiertos",
        "action_summary": "Accion congresional que plantea seguimiento abierto a obra regional y cronogramas de mantenimiento.",
        "action_date": "2022-01-29",
        "action_source_url": "https://www.secretariasenado.gov.co/senado/basedoc/",
        "action_source_system": "Congreso",
        "similarity_score": 0.75,
        "status": "con_accion_registrada",
        "status_confidence": 0.64,
        "politician_coherence_score": 0.57,
        "evidence_snippet": "Coincidencia alta entre promesa de mantenimiento vial y accion radicada.",
        "election_year": 2022,
        "scored_at": "2022-04-03T13:00:05+00:00",
        "extraction_confidence": 0.79,
        "domain_confidence": 0.72,
    },
    {
        "coherence_id": "demo_008",
        "promise_id": "p_demo_008",
        "action_id": "a_demo_008",
        "politician_id": "pol_003",
        "politician_name": "Sergio Fajardo",
        "chamber": "Presidencia 2022",
        "party": "Centro",
        "domain": "social",
        "promise_text": "Consolidaremos una ruta de cuidado y alimentacion para hogares con jefatura femenina.",
        "promise_source_url": "https://www.registraduria.gov.co/",
        "promise_source_label": "Cabildo abierto",
        "action_title": "Audiencia sobre cuidado comunitario y alimentacion escolar",
        "action_summary": "Seguimiento a programas de cuidado y seguridad alimentaria en municipios intermedios.",
        "action_date": "2022-03-16",
        "action_source_url": "https://www.imprenta.gov.co/gacetap/gaceta.indice",
        "action_source_system": "Gaceta",
        "similarity_score": 0.49,
        "status": "en_seguimiento",
        "status_confidence": 0.21,
        "politician_coherence_score": 0.57,
        "evidence_snippet": "Existe una relacion tematica clara, pero la accion sigue siendo parcial frente al compromiso.",
        "election_year": 2022,
        "scored_at": "2022-04-03T13:00:05+00:00",
        "extraction_confidence": 0.76,
        "domain_confidence": 0.73,
    },
]


def _safe_read_parquet(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    try:
        return pd.read_parquet(path)
    except Exception:
        return pd.DataFrame()


@lru_cache(maxsize=1)
def load_candidate_reference() -> dict[str, dict[str, Any]]:
    if not CANDIDATES_PATH.exists():
        return {}
    try:
        with open(CANDIDATES_PATH, "r", encoding="utf-8") as handle:
            rows = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return {}
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        politician_id = str(row.get("politician_id") or "").strip()
        if not politician_id:
            continue
        out[politician_id] = row
    return out


def _fallback_politician_meta(politician_id: str) -> dict[str, str]:
    ref = load_candidate_reference().get(politician_id, {})
    fallback = POLITICIAN_FALLBACKS.get(politician_id, {})
    name = ref.get("name") or fallback.get("politician_name") or politician_id.replace("_", " ").title()
    chamber = ref.get("chamber") or fallback.get("chamber") or "Cobertura piloto"
    party = ref.get("party") or fallback.get("party") or "Sin referencia"
    return {
        "politician_name": str(name),
        "chamber": str(chamber),
        "party": str(party),
    }


def _build_actual_frame() -> pd.DataFrame:
    coherence = _safe_read_parquet(COHERENCE_PATH)
    if coherence.empty:
        return pd.DataFrame()

    promises = _safe_read_parquet(PROMISES_PATH)
    actions = _safe_read_parquet(ACTIONS_PATH)

    frame = coherence.copy()
    if not promises.empty and "promise_id" in promises.columns:
        promise_cols = [
            "promise_id",
            "politician_name_norm",
            "chamber",
            "party",
            "promise_text",
            "source_url",
            "source_type",
            "extraction_confidence",
            "domain_confidence",
        ]
        available = [col for col in promise_cols if col in promises.columns]
        promise_view = promises[available].copy()
        rename_map = {
            "politician_name_norm": "politician_name",
            "source_url": "promise_source_url",
            "source_type": "promise_source_label",
        }
        promise_view = promise_view.rename(columns=rename_map)
        frame = frame.merge(promise_view, on="promise_id", how="left")

    if not actions.empty and "action_id" in actions.columns:
        action_cols = [
            "action_id",
            "action_title",
            "action_text_summary",
            "action_date",
            "source_url",
            "source_system",
        ]
        available = [col for col in action_cols if col in actions.columns]
        action_view = actions[available].copy().rename(
            columns={
                "action_text_summary": "action_summary",
                "source_url": "action_source_url",
                "source_system": "action_source_system",
            }
        )
        frame = frame.merge(action_view, on="action_id", how="left")

    for politician_id in frame["politician_id"].dropna().unique():
        meta = _fallback_politician_meta(str(politician_id))
        mask = frame["politician_id"] == politician_id
        for key, value in meta.items():
            if key not in frame.columns:
                frame[key] = ""
            frame.loc[mask, key] = frame.loc[mask, key].fillna("").replace("", value)

    if "promise_text" not in frame.columns:
        frame["promise_text"] = frame["domain"].map(
            {
                "educacion": "Compromiso de ampliacion educativa extraido de la corrida actual.",
                "salud": "Compromiso de mejora en acceso a salud extraido de la corrida actual.",
                "seguridad": "Compromiso de seguridad publica extraido de la corrida actual.",
                "economia": "Compromiso economico extraido de la corrida actual.",
            }
        ).fillna("Compromiso extraido del pipeline actual.")
    if "promise_source_url" not in frame.columns:
        frame["promise_source_url"] = "https://www.registraduria.gov.co/"
    if "promise_source_label" not in frame.columns:
        frame["promise_source_label"] = "Cobertura piloto"
    if "action_title" not in frame.columns:
        frame["action_title"] = frame["status"].map(
            {
                "con_accion_registrada": "Accion vinculada por similitud NLP",
                "en_seguimiento": "Accion parcial vinculada por similitud NLP",
                "sin_accion_registrada": "Sin evidencia enlazada",
            }
        ).fillna("Sin evidencia enlazada")
    if "action_summary" not in frame.columns:
        frame["action_summary"] = frame.get("evidence_snippet", "").fillna("")
    if "action_source_url" not in frame.columns:
        frame["action_source_url"] = "https://www.secretariasenado.gov.co/senado/basedoc/"
    if "action_source_system" not in frame.columns:
        frame["action_source_system"] = "Cobertura"
    if "action_date" not in frame.columns:
        frame["action_date"] = ""
    if "extraction_confidence" not in frame.columns:
        frame["extraction_confidence"] = 0.72
    if "domain_confidence" not in frame.columns:
        frame["domain_confidence"] = 0.68
    return frame


@lru_cache(maxsize=1)
def load_promises_frame() -> tuple[pd.DataFrame, str]:
    frame = _build_actual_frame()
    if len(frame) >= 6 and {"politician_name", "promise_text", "action_title"}.issubset(frame.columns):
        return frame, "live"
    return pd.DataFrame(DEMO_ROWS), "pilot"


def _filter_frame(
    frame: pd.DataFrame,
    *,
    politician_id: str | None = None,
    domain: str | None = None,
    status: str | None = None,
    election_year: int | None = None,
    chamber: str | None = None,
    query: str | None = None,
) -> pd.DataFrame:
    view = frame.copy()
    if politician_id:
        view = view[view["politician_id"] == politician_id]
    if domain and domain != "all":
        view = view[view["domain"] == domain]
    if status and status != "all":
        view = view[view["status"] == status]
    if election_year:
        view = view[pd.to_numeric(view["election_year"], errors="coerce").fillna(0).astype(int) == int(election_year)]
    if chamber and chamber != "all" and "chamber" in view.columns:
        needle = chamber.lower()
        chamber_text = view["chamber"].fillna("").astype(str).str.lower()
        if needle == "house":
            view = view[chamber_text.str.contains("cámara|camara|representante", regex=True)]
        elif needle == "senate":
            view = view[chamber_text.str.contains("senado|senador", regex=True)]
        elif needle == "executive":
            view = view[~chamber_text.str.contains("cámara|camara|representante|senado|senador", regex=True)]
    if query:
        needle = query.strip().lower()
        if needle:
            haystack = (
                view["promise_text"].fillna("")
                + " "
                + view["action_title"].fillna("")
                + " "
                + view["politician_name"].fillna("")
                + " "
                + view["party"].fillna("")
            ).str.lower()
            view = view[haystack.str.contains(needle, na=False)]
    return view.reset_index(drop=True)


def _status_rate(frame: pd.DataFrame) -> float:
    if frame.empty:
        return 0.0
    active = frame["status"].isin(["con_accion_registrada", "en_seguimiento"]).sum()
    return round(active / len(frame) * 100, 1)


def _politician_option(frame: pd.DataFrame, lang: str) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in frame.sort_values(["politician_name", "party"]).to_dict(orient="records"):
        politician_id = str(row["politician_id"])
        if politician_id in seen:
            continue
        seen.add(politician_id)
        chamber = str(row.get("chamber") or "")
        name = str(row.get("politician_name") or politician_id)
        label = f"{name} · {chamber}" if chamber else name
        out.append({"value": politician_id, "label": label})
    return out


def _candidate_reference_options(election_year: int) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for row in load_candidate_reference().values():
        if int(row.get("election_year", 0) or 0) != election_year:
            continue
        if not bool(row.get("active", True)):
            continue
        politician_id = str(row.get("politician_id") or "").strip()
        name = str(row.get("name") or politician_id).strip()
        chamber = str(row.get("chamber") or "").strip()
        if not politician_id or not name:
            continue
        label = f"{name} · {chamber}" if chamber else name
        out.append({"value": politician_id, "label": label})
    return sorted(out, key=lambda item: item["label"])


def _domain_scores(frame: pd.DataFrame, lang: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for domain in DOMAIN_ORDER:
        slice_df = frame[frame["domain"] == domain]
        if slice_df.empty:
            continue
        rows.append(
            {
                "key": domain,
                "label": DOMAIN_LABELS[lang][domain],
                "score": round(float(slice_df["similarity_score"].mean()), 3),
                "promises": int(len(slice_df)),
            }
        )
    return rows


def _scorecard(frame: pd.DataFrame, lang: str, requested_politician: str | None) -> dict[str, Any]:
    if frame.empty:
        meta = _fallback_politician_meta(requested_politician or "")
        return {
            "politicianId": requested_politician or "",
            "politicianName": meta["politician_name"] if requested_politician else "—",
            "chamber": meta["chamber"] if requested_politician else "—",
            "party": meta["party"] if requested_politician else "—",
            "overallScore": 0,
            "statusCounts": {"fulfilled": 0, "monitoring": 0, "noAction": 0},
            "domains": [],
        }
    leader = frame.iloc[0]
    return {
        "politicianId": str(leader["politician_id"]),
        "politicianName": str(leader.get("politician_name") or leader["politician_id"]),
        "chamber": str(leader.get("chamber") or "Cobertura piloto"),
        "party": str(leader.get("party") or "Sin referencia"),
        "overallScore": round(float(frame["politician_coherence_score"].iloc[0]) * 100),
        "statusCounts": {
            "fulfilled": int((frame["status"] == "con_accion_registrada").sum()),
            "monitoring": int((frame["status"] == "en_seguimiento").sum()),
            "noAction": int((frame["status"] == "sin_accion_registrada").sum()),
        },
        "domains": _domain_scores(frame, lang),
    }


def _card(row: pd.Series, lang: str) -> dict[str, Any]:
    return {
        "id": str(row["coherence_id"]),
        "promiseId": str(row["promise_id"]),
        "politicianId": str(row["politician_id"]),
        "politicianName": str(row.get("politician_name") or row["politician_id"]),
        "domain": str(row["domain"]),
        "domainLabel": DOMAIN_LABELS[lang].get(str(row["domain"]), str(row["domain"]).title()),
        "status": str(row["status"]),
        "statusLabel": STATUS_LABELS[lang].get(str(row["status"]), str(row["status"])),
        "similarityScore": round(float(row["similarity_score"]) * 100),
        "statusConfidence": round(float(row.get("status_confidence", 0)) * 100),
        "extractionConfidence": round(float(row.get("extraction_confidence", 0)) * 100),
        "promiseText": str(row.get("promise_text") or "Sin texto disponible"),
        "promiseSourceUrl": str(row.get("promise_source_url") or "https://www.registraduria.gov.co/"),
        "promiseSourceLabel": str(row.get("promise_source_label") or "Fuente del compromiso"),
        "actionTitle": str(row.get("action_title") or "Sin evidencia enlazada"),
        "actionSummary": str(row.get("action_summary") or row.get("evidence_snippet") or ""),
        "actionDate": str(row.get("action_date") or ""),
        "actionSourceUrl": str(row.get("action_source_url") or "https://www.secretariasenado.gov.co/senado/basedoc/"),
        "actionSourceSystem": str(row.get("action_source_system") or "Cobertura"),
    }


def get_promises_payload(
    *,
    lang: str = "es",
    politician_id: str | None = None,
    domain: str = "all",
    status: str = "all",
    election_year: int = 2022,
    chamber: str | None = None,
    query: str | None = None,
    limit: int = 48,
) -> dict[str, Any]:
    frame, coverage_mode = load_promises_frame()
    base_year = frame.copy()
    if election_year:
        base_year = _filter_frame(base_year, election_year=election_year, chamber=chamber)

    options_frame = base_year if not base_year.empty else frame
    filtered = _filter_frame(
        base_year,
        politician_id=politician_id,
        domain=domain,
        status=status,
        election_year=election_year,
        chamber=chamber,
        query=query,
    )

    focus_frame = filtered
    if focus_frame.empty and politician_id:
        focus_frame = _filter_frame(base_year, politician_id=politician_id, chamber=chamber)
    if focus_frame.empty:
        first_politician = options_frame["politician_id"].iloc[0] if not options_frame.empty else None
        focus_frame = _filter_frame(
            options_frame,
            politician_id=str(first_politician) if first_politician else None,
            chamber=chamber,
        )

    last_scored = (
        str(options_frame["scored_at"].max())
        if not options_frame.empty and "scored_at" in options_frame.columns
        else None
    )
    sandbox_frame = _filter_frame(
        base_year,
        domain=domain,
        status=status,
        election_year=election_year,
        chamber=chamber,
        query=query,
    )
    cards_frame = filtered if not filtered.empty else focus_frame
    cards = [_card(row, lang) for _, row in cards_frame.head(limit).iterrows()]
    sandbox_cards = [_card(row, lang) for _, row in sandbox_frame.head(max(limit * 2, 72)).iterrows()]

    option_rows = _politician_option(options_frame, lang)
    if coverage_mode == "pilot":
        extra_candidates = _candidate_reference_options(election_year)
        seen = {item["value"] for item in option_rows}
        option_rows.extend(item for item in extra_candidates if item["value"] not in seen)

    return {
        "meta": {
            "lang": lang,
            "coverageMode": coverage_mode,
            "electionYear": election_year,
            "totalRows": int(len(options_frame)),
            "shownRows": int(len(cards_frame)),
            "lastScoredAt": last_scored,
            "pilotNote": (
                "Cobertura piloto: aun faltan fuentes completas de promesas y acciones."
                if lang == "es"
                else "Pilot coverage: full promise and action sources are still being completed."
            ),
        },
        "options": {
            "politicians": option_rows,
            "domains": [{"value": "all", "label": "Todos los dominios" if lang == "es" else "All domains"}]
            + [{"value": key, "label": DOMAIN_LABELS[lang][key]} for key in DOMAIN_ORDER],
            "statuses": [{"value": key, "label": value} for key, value in STATUS_LABELS[lang].items()],
            "years": sorted(pd.to_numeric(options_frame["election_year"], errors="coerce").dropna().astype(int).unique().tolist()) or [2022],
        },
        "kpis": {
            "politiciansTracked": int(options_frame["politician_id"].nunique()) if not options_frame.empty else 0,
            "promisesTracked": int(len(options_frame)),
            "coherenceRate": _status_rate(options_frame),
            "activeDomains": int(options_frame["domain"].nunique()) if not options_frame.empty else 0,
        },
        "scorecard": _scorecard(focus_frame, lang, politician_id),
        "cards": cards,
        "sandboxCards": sandbox_cards,
        "highlights": {
            "focusPolitician": _scorecard(focus_frame, lang, politician_id)["politicianName"],
            "focusDomain": DOMAIN_LABELS[lang].get(str(cards_frame["domain"].mode().iloc[0]), "—") if not cards_frame.empty else "—",
            "focusStatus": STATUS_LABELS[lang].get(str(cards_frame["status"].mode().iloc[0]), "—") if not cards_frame.empty else "—",
        },
    }
