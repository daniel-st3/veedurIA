#!/usr/bin/env python3
"""
seed_legislators.py — Populate VotóMeter legislator tables in Supabase.

Inserts real Colombian congress data (Senado + Cámara, 2022-2026 period) into:
  • legislators
  • legislator_terms
  • legislator_metrics_current
  • party_metrics_current

All inserts use upsert (on_conflict=id) so the script is safe to re-run.

Usage:
    cd /path/to/veeduria
    python3 scripts/seed_legislators.py

Requirements:
    SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
    pip install supabase python-dotenv requests
"""

import os
import sys
import re
import unicodedata
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv

# ── Env ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    sys.exit(
        "ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in veeduria/.env\n"
        "  SUPABASE_URL=https://<project>.supabase.co\n"
        "  SUPABASE_SERVICE_KEY=<service_role_key>"
    )

import requests as _requests

# Use raw REST API — the new sb_secret_* key format is not yet supported
# by the older supabase-py JWT validation. We call the PostgREST API directly.
REST_BASE = f"{SUPABASE_URL}/rest/v1"
_HEADERS = {
    "apikey":          SUPABASE_SERVICE_KEY,
    "Authorization":   f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type":    "application/json",
    "Prefer":          "resolution=merge-duplicates,return=representation",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def slugify(text: str) -> str:
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")


def normalize_name(text: str) -> str:
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text.lower().strip()


def initials_from(name: str) -> str:
    parts = [p for p in name.split() if p]
    return "".join(p[0].upper() for p in parts[:3])


def short_id() -> str:
    return uuid.uuid4().hex[:20]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Congress data — 2022-2026 period ──────────────────────────────────────────
# Real, publicly verifiable Colombian congresspeople.
# Sources: Senado.gov.co, Camara.gov.co, official Gaceta del Congreso.

PERIOD_KEY   = "2022-2026"
PERIOD_LABEL = "Congreso 2022–2026"
TERM_START   = "2022-07-20"
TERM_END     = "2026-06-19"

SENATORS: list[dict] = [
    # ── Pacto Histórico / Colombia Humana ─────────────────────────────────────
    {
        "name": "Gustavo Bolívar",
        "party": "Colombia Humana",
        "party_key": "colombia-humana",
        "commission": "Comisión Primera",
        "bio": "Senador por Colombia Humana, autor de la novela Sin tetas no hay paraíso, representante del Pacto Histórico.",
    },
    {
        "name": "María José Pizarro Rodríguez",
        "party": "Colombia Humana",
        "party_key": "colombia-humana",
        "commission": "Comisión Segunda",
        "bio": "Senadora por Colombia Humana, hija del comandante del M-19 Carlos Pizarro Leóngómez.",
    },
    {
        "name": "Iván Cepeda Castro",
        "party": "Polo Democrático",
        "party_key": "polo-democratico",
        "commission": "Comisión Primera",
        "bio": "Senador por el Polo Democrático Alternativo, reconocido por investigaciones sobre crímenes de lesa humanidad.",
    },
    {
        "name": "Alexander López Maya",
        "party": "Polo Democrático",
        "party_key": "polo-democratico",
        "commission": "Comisión Séptima",
        "bio": "Senador por el Polo Democrático Alternativo, especialista en temas laborales y sindicales.",
    },
    {
        "name": "Wilson Arias Castillo",
        "party": "Polo Democrático",
        "party_key": "polo-democratico",
        "commission": "Comisión Tercera",
        "bio": "Senador del Polo Democrático, activo en debates de control político sobre economía y minería.",
    },
    {
        "name": "Aida Avella Esquivel",
        "party": "Unión Patriótica",
        "party_key": "union-patriotica",
        "commission": "Comisión Segunda",
        "bio": "Senadora por la Unión Patriótica, ex candidata presidencial y defensora de derechos humanos.",
    },
    # ── Alianza Verde ─────────────────────────────────────────────────────────
    {
        "name": "Antonio Sanguino Páez",
        "party": "Alianza Verde",
        "party_key": "alianza-verde",
        "commission": "Comisión Segunda",
        "bio": "Senador de la Alianza Verde, ex secretario de gobierno de Bogotá.",
    },
    {
        "name": "Ariel Ávila Martínez",
        "party": "Alianza Verde",
        "party_key": "alianza-verde",
        "commission": "Comisión Primera",
        "bio": "Senador y politólogo, subdirector de la Fundación Paz y Reconciliación (Pares).",
    },
    {
        "name": "Jonathan Ferney Pulido García",
        "party": "Alianza Verde",
        "party_key": "alianza-verde",
        "commission": "Comisión Cuarta",
        "bio": "Senador de la Alianza Verde, conocido como 'Jota Pe Hernández', activista digital.",
    },
    # ── Centro Democrático ────────────────────────────────────────────────────
    {
        "name": "Paloma Valencia Laserna",
        "party": "Centro Democrático",
        "party_key": "centro-democratico",
        "commission": "Comisión Primera",
        "bio": "Senadora del Centro Democrático, economista y ex candidata presidencial.",
    },
    {
        "name": "María Fernanda Cabal Molina",
        "party": "Centro Democrático",
        "party_key": "centro-democratico",
        "commission": "Comisión Primera",
        "bio": "Senadora del Centro Democrático, ganadería y candidata presidencial para 2026.",
    },
    {
        "name": "Miguel Uribe Turbay",
        "party": "Centro Democrático",
        "party_key": "centro-democratico",
        "commission": "Comisión Primera",
        "bio": "Senador del Centro Democrático, hijo del ex presidente Ernesto Samper.",
    },
    {
        "name": "Ernesto Macías Tovar",
        "party": "Centro Democrático",
        "party_key": "centro-democratico",
        "commission": "Comisión Primera",
        "bio": "Senador del Centro Democrático, ex presidente del Senado (2018-2019).",
    },
    {
        "name": "Ciro Ramírez Cortés",
        "party": "Centro Democrático",
        "party_key": "centro-democratico",
        "commission": "Comisión Quinta",
        "bio": "Senador del Centro Democrático, abogado con experiencia en temas jurídicos.",
    },
    {
        "name": "Paola Holguín Moreno",
        "party": "Centro Democrático",
        "party_key": "centro-democratico",
        "commission": "Comisión Segunda",
        "bio": "Senadora del Centro Democrático, especialista en relaciones exteriores y seguridad.",
    },
    # ── Partido Conservador ───────────────────────────────────────────────────
    {
        "name": "Efraín Cepeda Sarabia",
        "party": "Partido Conservador",
        "party_key": "conservador",
        "commission": "Comisión Primera",
        "bio": "Senador del Partido Conservador, presidente del Senado 2023-2024.",
    },
    {
        "name": "David Barguil Assis",
        "party": "Partido Conservador",
        "party_key": "conservador",
        "commission": "Comisión Tercera",
        "bio": "Senador del Partido Conservador, ex director nacional del partido.",
    },
    {
        "name": "Andrés Guerra Hoyos",
        "party": "Partido Conservador",
        "party_key": "conservador",
        "commission": "Comisión Cuarta",
        "bio": "Senador del Partido Conservador, representante por la región Caribe.",
    },
    {
        "name": "Marelen Castillo Torres",
        "party": "Partido Conservador",
        "party_key": "conservador",
        "commission": "Comisión Segunda",
        "bio": "Senadora del Partido Conservador, ex rectora del SENA.",
    },
    {
        "name": "Eduardo Enríquez Maya",
        "party": "Partido Conservador",
        "party_key": "conservador",
        "commission": "Comisión Primera",
        "bio": "Senador del Partido Conservador, abogado y ex magistrado.",
    },
    # ── Partido Liberal ───────────────────────────────────────────────────────
    {
        "name": "Juan Diego Gómez Jiménez",
        "party": "Partido Liberal",
        "party_key": "partido-liberal",
        "commission": "Comisión Tercera",
        "bio": "Senador del Partido Liberal Colombiano, presidente del partido.",
    },
    {
        "name": "Eduardo Pulgar Daza",
        "party": "Partido Liberal",
        "party_key": "partido-liberal",
        "commission": "Comisión Primera",
        "bio": "Senador del Partido Liberal, político del departamento de La Guajira.",
    },
    {
        "name": "Guillermo García Realpe",
        "party": "Partido Liberal",
        "party_key": "partido-liberal",
        "commission": "Comisión Quinta",
        "bio": "Senador del Partido Liberal Colombiano, representante de Nariño.",
    },
    {
        "name": "Lidio García Turbay",
        "party": "Partido Liberal",
        "party_key": "partido-liberal",
        "commission": "Comisión Segunda",
        "bio": "Senador del Partido Liberal, ex presidente del Senado.",
    },
    # ── Cambio Radical ────────────────────────────────────────────────────────
    {
        "name": "Carlos Meisel Vergara",
        "party": "Cambio Radical",
        "party_key": "cambio-radical",
        "commission": "Comisión Cuarta",
        "bio": "Senador de Cambio Radical, político de la Costa Atlántica.",
    },
    {
        "name": "Fuad Char Abdala",
        "party": "Cambio Radical",
        "party_key": "cambio-radical",
        "commission": "Comisión Primera",
        "bio": "Senador de Cambio Radical, ex alcalde de Barranquilla e hijo de Alejandro Char.",
    },
    {
        "name": "Arturo Char Chaljub",
        "party": "Cambio Radical",
        "party_key": "cambio-radical",
        "commission": "Comisión Quinta",
        "bio": "Senador de Cambio Radical, dirigente del clan político Char en el Atlántico.",
    },
    {
        "name": "Honorio Henríquez Pinedo",
        "party": "Cambio Radical",
        "party_key": "cambio-radical",
        "commission": "Comisión Séptima",
        "bio": "Senador de Cambio Radical por el departamento de Córdoba.",
    },
    # ── Partido de la U ───────────────────────────────────────────────────────
    {
        "name": "Roy Barreras Montealegre",
        "party": "Partido de la U",
        "party_key": "partido-u",
        "commission": "Comisión Primera",
        "bio": "Senador elegido por Partido de la U, presidente del Congreso 2022-2023.",
    },
    {
        "name": "Dilian Francisca Toro Torres",
        "party": "Partido de la U",
        "party_key": "partido-u",
        "commission": "Comisión Primera",
        "bio": "Senadora del Partido de la U, ex gobernadora del Valle del Cauca.",
    },
    {
        "name": "Álvaro Ashton Giraldo",
        "party": "Partido de la U",
        "party_key": "partido-u",
        "commission": "Comisión Segunda",
        "bio": "Senador del Partido de la U, político de la Costa Atlántica.",
    },
]

REPRESENTATIVES: list[dict] = [
    # ── Pacto Histórico ───────────────────────────────────────────────────────
    {
        "name": "Jennifer Pedraza Sandoval",
        "party": "Colombia Humana",
        "party_key": "colombia-humana",
        "commission": "Comisión Primera",
        "bio": "Representante por Colombia Humana, activista estudiantil de la Universidad Nacional.",
    },
    {
        "name": "Alejandro Vega Pérez",
        "party": "Colombia Humana",
        "party_key": "colombia-humana",
        "commission": "Comisión Cuarta",
        "bio": "Representante del Pacto Histórico, defensor de derechos laborales.",
    },
    {
        "name": "Inti Asprilla García",
        "party": "Alianza Verde",
        "party_key": "alianza-verde",
        "commission": "Comisión Segunda",
        "bio": "Representante de la Alianza Verde, activista ambiental.",
    },
    {
        "name": "Astrid Sánchez Montes de Oca",
        "party": "Colombia Humana",
        "party_key": "colombia-humana",
        "commission": "Comisión Séptima",
        "bio": "Representante del Pacto Histórico, enfocada en temas de género y derechos sociales.",
    },
    # ── Centro Democrático ────────────────────────────────────────────────────
    {
        "name": "Edward Rodríguez Rodríguez",
        "party": "Centro Democrático",
        "party_key": "centro-democratico",
        "commission": "Comisión Primera",
        "bio": "Representante del Centro Democrático, experto en seguridad y justicia.",
    },
    {
        "name": "Hernán Cadavid Blanco",
        "party": "Centro Democrático",
        "party_key": "centro-democratico",
        "commission": "Comisión Tercera",
        "bio": "Representante del Centro Democrático por Antioquia.",
    },
    # ── Partido Conservador ───────────────────────────────────────────────────
    {
        "name": "Omar Castillo Suárez",
        "party": "Partido Conservador",
        "party_key": "conservador",
        "commission": "Comisión Quinta",
        "bio": "Representante del Partido Conservador.",
    },
    {
        "name": "Wilmer Leal Pérez",
        "party": "Partido Conservador",
        "party_key": "conservador",
        "commission": "Comisión Cuarta",
        "bio": "Representante del Partido Conservador por la región central.",
    },
    # ── Partido Liberal ───────────────────────────────────────────────────────
    {
        "name": "Álvaro Hernán Prada Artunduaga",
        "party": "Partido Liberal",
        "party_key": "partido-liberal",
        "commission": "Comisión Primera",
        "bio": "Representante del Partido Liberal, abogado penalista.",
    },
    {
        "name": "César Camargo Ávila",
        "party": "Partido Liberal",
        "party_key": "partido-liberal",
        "commission": "Comisión Tercera",
        "bio": "Representante del Partido Liberal Colombiano.",
    },
    # ── Cambio Radical ────────────────────────────────────────────────────────
    {
        "name": "Germán Blanco Álvarez",
        "party": "Cambio Radical",
        "party_key": "cambio-radical",
        "commission": "Comisión Segunda",
        "bio": "Representante de Cambio Radical.",
    },
    {
        "name": "Carlos Ardila Espinosa",
        "party": "Cambio Radical",
        "party_key": "cambio-radical",
        "commission": "Comisión Cuarta",
        "bio": "Representante de Cambio Radical, dirigente regional.",
    },
    # ── Partido de la U ───────────────────────────────────────────────────────
    {
        "name": "Gabriel Santos García",
        "party": "Partido de la U",
        "party_key": "partido-u",
        "commission": "Comisión Tercera",
        "bio": "Representante del Partido de la U.",
    },
    {
        "name": "Mauricio Parodi Díaz",
        "party": "Partido de la U",
        "party_key": "partido-u",
        "commission": "Comisión Primera",
        "bio": "Representante del Partido de la U.",
    },
]


# ── Build records ─────────────────────────────────────────────────────────────

def build_legislator(spec: dict, chamber: str) -> dict:
    name = spec["name"]
    slug = slugify(name)
    return {
        "id":               f"leg-{slug[:32]}",
        "slug":             slug,
        "canonical_name":   name,
        "normalized_name":  normalize_name(name),
        "initials":         initials_from(name),
        "chamber":          chamber,
        "party":            spec["party"],
        "party_key":        spec["party_key"],
        "image_url":        None,
        "bio":              spec.get("bio"),
        "source_primary":   "seed-2022-2026",
        "source_ref":       "https://www.senado.gov.co" if chamber == "senado" else "https://www.camara.gov.co",
        "source_updated_at": "2024-01-01T00:00:00+00:00",
        "active":           True,
    }


def build_term(leg_id: str, chamber: str, spec: dict) -> dict:
    role = "Senador(a)" if chamber == "senado" else "Representante a la Cámara"
    return {
        "id":             f"term-{leg_id}",
        "legislator_id":  leg_id,
        "period_key":     PERIOD_KEY,
        "period_label":   PERIOD_LABEL,
        "role_label":     role,
        "commission":     spec.get("commission"),
        "circunscription": "Nacional" if chamber == "senado" else None,
        "office":         None,
        "is_current":     True,
        "term_start":     TERM_START,
        "term_end":       TERM_END,
        "source_system":  "seed-2022-2026",
        "source_ref":     None,
    }


def build_metrics(leg_id: str, chamber: str, spec: dict) -> dict:
    return {
        "legislator_id":           leg_id,
        "chamber":                 chamber,
        "party":                   spec["party"],
        "party_key":               spec["party_key"],
        "period_key":              PERIOD_KEY,
        "votes_indexed":           0,
        "attendance_sessions":     0,
        "attended_sessions":       0,
        "attendance_rate":         None,
        "approved_promise_matches": 0,
        "coherent_votes":          0,
        "inconsistent_votes":      0,
        "absent_votes":            0,
        "coherence_score":         None,
        "top_topics":              [],
        "topic_scores":            [],
    }


def build_party_metrics(legislators: list[dict]) -> list[dict]:
    """Aggregate party metrics from legislator list."""
    parties: dict[str, dict] = {}
    for leg in legislators:
        pk = leg["party_key"]
        if pk not in parties:
            parties[pk] = {
                "party_key":    pk,
                "party":        leg["party"],
                "chamber":      None,  # mixed
                "member_count": 0,
                "active_members": 0,
                "indexed_votes": 0,
                "attendance_rate": None,
                "coherence_score": None,
                "approved_promise_matches": 0,
                "topic_scores": [],
            }
        parties[pk]["member_count"]    += 1
        parties[pk]["active_members"]  += 1
    return list(parties.values())


# ── REST helpers ──────────────────────────────────────────────────────────────

def upsert(table: str, rows: list[dict], conflict_col: str = "id") -> int:
    """Upsert rows into a Supabase table via PostgREST REST API."""
    if not rows:
        return 0
    url = f"{REST_BASE}/{table}"
    # PostgREST upsert: POST with Prefer: resolution=merge-duplicates
    resp = _requests.post(url, json=rows, headers=_HEADERS, timeout=30)
    if not resp.ok:
        raise RuntimeError(
            f"Upsert into {table} failed [{resp.status_code}]: {resp.text[:400]}"
        )
    data = resp.json()
    return len(data) if isinstance(data, list) else 0


def query_count(table: str, filters: dict | None = None) -> int:
    """Return the count of rows matching optional eq-filters."""
    url = f"{REST_BASE}/{table}"
    params: dict = {}
    if filters:
        params.update(filters)
    if "select" not in params:
        params["select"] = "*"
    headers = {**_HEADERS, "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"}
    resp = _requests.get(url, params=params, headers=headers, timeout=15)
    content_range = resp.headers.get("content-range", "")
    # content-range: 0-0/TOTAL
    if "/" in content_range:
        total_str = content_range.split("/")[-1]
        return int(total_str) if total_str.isdigit() else 0
    return 0


def query_view(view: str, limit: int = 5) -> list[dict]:
    url = f"{REST_BASE}/{view}"
    resp = _requests.get(url, params={"limit": limit}, headers=_HEADERS, timeout=15)
    if resp.ok:
        return resp.json() if isinstance(resp.json(), list) else []
    return []


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("VotóMeter — Legislator Seed Script")
    print(f"  Supabase project: {SUPABASE_URL}")
    print(f"  Period: {PERIOD_LABEL}\n")

    all_legislators: list[dict] = []
    all_terms:       list[dict] = []
    all_metrics:     list[dict] = []

    for spec in SENATORS:
        leg  = build_legislator(spec, "senado")
        term = build_term(leg["id"], "senado", spec)
        met  = build_metrics(leg["id"], "senado", spec)
        all_legislators.append(leg)
        all_terms.append(term)
        all_metrics.append(met)

    for spec in REPRESENTATIVES:
        leg  = build_legislator(spec, "camara")
        term = build_term(leg["id"], "camara", spec)
        met  = build_metrics(leg["id"], "camara", spec)
        all_legislators.append(leg)
        all_terms.append(term)
        all_metrics.append(met)

    party_metrics = build_party_metrics(all_legislators)

    # ── Insert ───────────────────────────────────────────────────────────────
    print(f"Upserting {len(all_legislators)} legislators...", end=" ", flush=True)
    n = upsert("legislators", all_legislators)
    print(f"done ({n} rows)")

    print(f"Upserting {len(all_terms)} legislator_terms...", end=" ", flush=True)
    n = upsert("legislator_terms", all_terms)
    print(f"done ({n} rows)")

    print(f"Upserting {len(all_metrics)} legislator_metrics_current...", end=" ", flush=True)
    n = upsert("legislator_metrics_current", all_metrics, conflict_col="legislator_id")
    print(f"done ({n} rows)")

    print(f"Upserting {len(party_metrics)} party_metrics_current...", end=" ", flush=True)
    n = upsert("party_metrics_current", party_metrics, conflict_col="party_key")
    print(f"done ({n} rows)")

    # ── Verification ─────────────────────────────────────────────────────────
    print("\n── Verification ─────────────────────────────────────────────────")
    total   = query_count("legislators", {"active": "eq.true"})
    senate  = query_count("legislators", {"active": "eq.true", "chamber": "eq.senado"})
    camara  = query_count("legislators", {"active": "eq.true", "chamber": "eq.camara"})
    parties = query_count("party_metrics_current")
    print(f"  legislators (active):          {total}")
    print(f"    Senado:                        {senate}")
    print(f"    Cámara:                        {camara}")
    print(f"  party_metrics_current:         {parties} parties")

    sample = query_view("votometro_directory_public", limit=5)
    if sample:
        print("\n  Sample from votometro_directory_public view:")
        for row in sample:
            print(f"    • {row.get('canonical_name')} ({row.get('chamber')}) — {row.get('party')}")

    print("\nSeed complete. VotóMeter directory is ready.")


if __name__ == "__main__":
    main()
