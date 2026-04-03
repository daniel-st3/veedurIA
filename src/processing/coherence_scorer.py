"""
Coherence scorer for VeedurIA PromesóMetro.

Computes cosine similarity between each promise embedding and all action embeddings
within the same domain and ±365-day window. Assigns a status and confidence.

Algorithm:
    1. Embed all promises + actions with paraphrase-multilingual-MiniLM-L12-v2.
    2. Pre-filter action pool: same domain_hint AND ±365 days of promise extraction.
    3. Cosine similarity = np.dot(L2-normalized promise, L2-normalized actions.T).
    4. Best match = argmax per promise.
    5. Status thresholds:
        ≥ 0.72 → con_accion_registrada
        ≥ 0.45 → en_seguimiento
        <  0.45 → sin_accion_registrada
    6. Aggregate politician coherence score (weighted mean over domains).

Output: coherence.parquet

CLI:
    python -m src.processing.coherence_scorer
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from src.models.promise_model import encode_texts
from src.utils.logger import get_logger, log_etl_event

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Thresholds — constants referenced by tests and UI
# ---------------------------------------------------------------------------

SIMILARITY_FULFILLED     = 0.72   # ≥ → con_accion_registrada
SIMILARITY_IN_PROGRESS   = 0.45   # ≥ and < 0.72 → en_seguimiento
SIMILARITY_MIN_CANDIDATE = 0.30   # minimum to even consider a match

STATUS_FULFILLED   = "con_accion_registrada"
STATUS_IN_PROGRESS = "en_seguimiento"
STATUS_NO_ACTION   = "sin_accion_registrada"

# Domain size weight: ≥ 3 promises in domain → full weight, else half
DOMAIN_MIN_PROMISES = 3
DOMAIN_WEIGHT_FULL  = 1.0
DOMAIN_WEIGHT_HALF  = 0.5

# Date pre-filter window (days) — actions must be within this window of the promise's year
DATE_WINDOW_DAYS = 365

BATCH_SIZE = 64  # encoding batch size

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECT_ROOT    = Path(__file__).resolve().parent.parent.parent
PROMISES_DIR    = PROJECT_ROOT / "data" / "processed" / "promises"
PROMISES_PATH   = PROMISES_DIR / "promises.parquet"
ACTIONS_PATH    = PROMISES_DIR / "actions.parquet"
COHERENCE_PATH  = PROMISES_DIR / "coherence.parquet"


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def score_coherence(
    df_promises: pd.DataFrame | None = None,
    df_actions:  pd.DataFrame | None = None,
) -> pd.DataFrame:
    """
    Compute promise-action coherence scores.

    Args:
        df_promises: If None, loads from PROMISES_PATH.
        df_actions:  If None, loads from ACTIONS_PATH.

    Returns:
        DataFrame written to coherence.parquet.
    """
    if df_promises is None:
        df_promises = _load_parquet(PROMISES_PATH, "promises")
    if df_actions is None:
        df_actions = _load_parquet(ACTIONS_PATH, "actions")

    if df_promises.empty:
        logger.warning("No promises to score.")
        return pd.DataFrame(columns=_COHERENCE_SCHEMA)

    logger.info(
        "Scoring coherence: %d promises × %d actions",
        len(df_promises), len(df_actions),
    )

    # Embed all promises
    promise_texts = df_promises["promise_text_clean"].fillna("").tolist()
    promise_embs  = encode_texts(promise_texts, batch_size=BATCH_SIZE, normalize=True)

    # Embed all actions (if any)
    action_embs: np.ndarray | None = None
    if not df_actions.empty:
        action_texts = df_actions["action_text_clean"].fillna("").tolist()
        action_embs  = encode_texts(action_texts, batch_size=BATCH_SIZE, normalize=True)

    rows: list[dict] = []
    scored_at = datetime.now(timezone.utc).isoformat()

    for i, promise_row in df_promises.iterrows():
        p_emb = promise_embs[i] if promise_embs is not None else None
        row = _score_single_promise(
            promise_row=promise_row,
            p_emb=p_emb,
            df_actions=df_actions,
            action_embs=action_embs,
            scored_at=scored_at,
        )
        rows.append(row)

    df_coherence = pd.DataFrame(rows)
    df_coherence = _add_politician_aggregate(df_coherence)

    PROMISES_DIR.mkdir(parents=True, exist_ok=True)
    df_coherence.to_parquet(
        COHERENCE_PATH, engine="pyarrow", compression="snappy", index=False
    )
    logger.info("Wrote coherence.parquet: %d rows → %s", len(df_coherence), COHERENCE_PATH)
    log_etl_event("coherence_scoring_complete", rows=len(df_coherence))
    return df_coherence


# ---------------------------------------------------------------------------
# Single-promise scorer
# ---------------------------------------------------------------------------

def _score_single_promise(
    promise_row: pd.Series,
    p_emb: np.ndarray | None,
    df_actions: pd.DataFrame,
    action_embs: np.ndarray | None,
    scored_at: str,
) -> dict:
    pid       = promise_row.get("promise_id", "")
    pol_id    = promise_row.get("politician_id", "")
    domain    = promise_row.get("domain", "otro")
    ext_conf  = float(promise_row.get("extraction_confidence", 0.5))
    p_year    = str(promise_row.get("election_year", 2026))

    base = {
        "coherence_id":             f"c_{pid}",
        "promise_id":               pid,
        "action_id":                "NONE",
        "politician_id":            pol_id,
        "domain":                   domain,
        "similarity_score":         0.0,
        "status":                   STATUS_NO_ACTION,
        "status_confidence":        1.0,
        "politician_coherence_score": 0.0,  # filled by aggregate pass
        "evidence_snippet":         "",
        "election_year":            promise_row.get("election_year", 2026),
        "scored_at":                scored_at,
    }

    if p_emb is None or df_actions.empty or action_embs is None:
        base["status_confidence"] = _status_confidence(STATUS_NO_ACTION, 0.0)
        return base

    # Pre-filter actions: same domain AND within ±DATE_WINDOW_DAYS
    mask = _build_action_mask(df_actions, domain, p_year)
    candidate_indices = np.where(mask)[0]

    if len(candidate_indices) == 0:
        return base

    cand_embs = action_embs[candidate_indices]
    # Cosine similarity (both already L2-normalized → dot product = cosine)
    sims = np.dot(cand_embs, p_emb)

    best_local_idx = int(np.argmax(sims))
    best_sim       = float(sims[best_local_idx])

    if best_sim < SIMILARITY_MIN_CANDIDATE:
        return base

    best_action_idx = candidate_indices[best_local_idx]
    best_action     = df_actions.iloc[best_action_idx]

    status, status_conf = assign_status(best_sim)
    snippet = _build_snippet(best_action)

    base.update({
        "action_id":          best_action.get("action_id", "NONE"),
        "similarity_score":   round(best_sim, 4),
        "status":             status,
        "status_confidence":  round(status_conf, 3),
        "evidence_snippet":   snippet,
    })
    return base


# ---------------------------------------------------------------------------
# Status assignment (exported for tests)
# ---------------------------------------------------------------------------

def assign_status(similarity: float) -> tuple[str, float]:
    """
    Map similarity score → (status, confidence).

    Returns:
        status:     One of STATUS_FULFILLED / STATUS_IN_PROGRESS / STATUS_NO_ACTION
        confidence: 0.0–1.0 float
    """
    if similarity >= SIMILARITY_FULFILLED:
        conf = (similarity - SIMILARITY_FULFILLED) / (1.0 - SIMILARITY_FULFILLED)
        return STATUS_FULFILLED, min(1.0, conf)
    if similarity >= SIMILARITY_IN_PROGRESS:
        conf = (similarity - SIMILARITY_IN_PROGRESS) / (SIMILARITY_FULFILLED - SIMILARITY_IN_PROGRESS)
        return STATUS_IN_PROGRESS, conf
    conf = 1.0 - (similarity / SIMILARITY_IN_PROGRESS) if SIMILARITY_IN_PROGRESS > 0 else 1.0
    return STATUS_NO_ACTION, min(1.0, conf)


def _status_confidence(status: str, sim: float) -> float:
    _, conf = assign_status(sim)
    return conf


# ---------------------------------------------------------------------------
# Politician aggregate score
# ---------------------------------------------------------------------------

def _add_politician_aggregate(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute politician_coherence_score (weighted mean over domains).

    Rules:
        - Promises with action_id="NONE" are excluded from both numerator and denominator.
        - Domain weight = 1.0 if ≥ 3 promises in domain, else 0.5.
        - Score per domain = mean similarity of matched promises in that domain.
        - Aggregate = Σ(domain_score × weight) / Σ(weight).
    """
    if df.empty:
        return df

    df = df.copy()
    df["politician_coherence_score"] = 0.0

    for pol_id, group in df.groupby("politician_id"):
        # Exclude NONE matches
        matched = group[group["action_id"] != "NONE"]

        if matched.empty:
            df.loc[group.index, "politician_coherence_score"] = 0.0
            continue

        weighted_sum   = 0.0
        weight_total   = 0.0

        for domain, domain_group in matched.groupby("domain"):
            n          = len(group[group["domain"] == domain])  # all promises in domain
            weight     = DOMAIN_WEIGHT_FULL if n >= DOMAIN_MIN_PROMISES else DOMAIN_WEIGHT_HALF
            domain_sim = float(domain_group["similarity_score"].mean())
            weighted_sum  += domain_sim * weight
            weight_total  += weight

        score = weighted_sum / weight_total if weight_total > 0 else 0.0
        score = round(min(1.0, max(0.0, score)), 4)
        df.loc[group.index, "politician_coherence_score"] = score

    return df


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_action_mask(df_actions: pd.DataFrame, domain: str, year: str) -> np.ndarray:
    """
    Boolean mask for actions that match domain (or are domain-agnostic)
    and fall within DATE_WINDOW_DAYS of the promise election year.
    """
    domain_mask = (
        (df_actions["domain_hint"] == domain) |
        (df_actions["domain_hint"].isna()) |
        (df_actions["domain_hint"] == "") |
        (df_actions["domain_hint"] == "otro")
    )

    try:
        ref_year = int(year)
        action_years = pd.to_datetime(
            df_actions["action_date"], errors="coerce"
        ).dt.year.fillna(ref_year).astype(int)
        year_mask = (action_years >= ref_year - 1) & (action_years <= ref_year + 1)
    except Exception:
        year_mask = pd.Series([True] * len(df_actions))

    return (domain_mask & year_mask).to_numpy()


def _build_snippet(action_row: pd.Series) -> str:
    """Build a 200-character evidence snippet from an action row."""
    text = str(action_row.get("action_text_summary", ""))
    return text[:200].strip()


def _load_parquet(path: Path, name: str) -> pd.DataFrame:
    if not path.exists():
        logger.warning("%s.parquet not found at %s", name, path)
        return pd.DataFrame()
    return pd.read_parquet(path, engine="pyarrow")


# ---------------------------------------------------------------------------
# Schema constant
# ---------------------------------------------------------------------------

_COHERENCE_SCHEMA = [
    "coherence_id", "promise_id", "action_id", "politician_id",
    "domain", "similarity_score", "status", "status_confidence",
    "politician_coherence_score", "evidence_snippet",
    "election_year", "scored_at",
]


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compute promise-action coherence scores.")
    parser.add_argument(
        "--promises", type=str, default=None,
        help="Path to promises.parquet (default: data/processed/promises/promises.parquet)",
    )
    parser.add_argument(
        "--actions", type=str, default=None,
        help="Path to actions.parquet (default: data/processed/promises/actions.parquet)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    df_p = pd.read_parquet(args.promises) if args.promises else None
    df_a = pd.read_parquet(args.actions)  if args.actions  else None
    df_c = score_coherence(df_p, df_a)
    print(f"Done. {len(df_c)} coherence rows written to coherence.parquet.")
    if not df_c.empty:
        status_counts = df_c["status"].value_counts().to_dict()
        print(f"Status breakdown: {status_counts}")
