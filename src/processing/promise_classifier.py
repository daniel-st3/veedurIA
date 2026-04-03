"""
Promise domain classifier for VeedurIA PromesóMetro.

Two-mode classifier:
  - train:    Fit BERTopic on promise_text_clean corpus, save model.
  - classify: Load saved model (or keyword fallback) and label each promise.

Assigns one of 9 domain labels:
    educacion, salud, seguridad, economia, infraestructura,
    medio_ambiente, justicia, social, otro

Output: updates the `domain` and `domain_confidence` columns of promises.parquet.

Usage:
    python -m src.processing.promise_classifier --action=train
    python -m src.processing.promise_classifier --action=classify

Or programmatically:
    from src.processing.promise_classifier import classify_promises
    df = classify_promises(df_promises)
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

from src.ingestion.congreso_client import DOMAIN_KEYWORDS, _infer_domain
from src.utils.logger import get_logger, log_etl_event

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PROJECT_ROOT   = Path(__file__).resolve().parent.parent.parent
PROMISES_PATH  = PROJECT_ROOT / "data" / "processed" / "promises" / "promises.parquet"
MODEL_DIR      = PROJECT_ROOT / "data" / "processed" / "models" / "bertopic_promises"

VALID_DOMAINS = {
    "educacion", "salud", "seguridad", "economia",
    "infraestructura", "medio_ambiente", "justicia", "social", "otro",
}

# BERTopic hyperparams — defined here to make them easy to tune
BERTOPIC_NR_TOPICS    = 9
BERTOPIC_MIN_TOPIC    = 3
EMBEDDING_MODEL_NAME  = "paraphrase-multilingual-MiniLM-L12-v2"

# Keyword fallback confidence when BERTopic model is unavailable
KEYWORD_FALLBACK_CONF = 0.4


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def train_classifier(df: pd.DataFrame) -> None:
    """
    Fit a BERTopic model on promise_text_clean and save it to MODEL_DIR.

    Args:
        df: DataFrame with column `promise_text_clean`.
    """
    if "promise_text_clean" not in df.columns:
        raise ValueError("DataFrame must have column 'promise_text_clean'")

    texts = df["promise_text_clean"].dropna().tolist()
    if len(texts) < BERTOPIC_MIN_TOPIC:
        logger.warning(
            "Too few promises to train BERTopic (%d < %d). Skipping.",
            len(texts), BERTOPIC_MIN_TOPIC,
        )
        return

    try:
        from bertopic import BERTopic
        from sentence_transformers import SentenceTransformer
    except ImportError:
        logger.error("BERTopic or sentence-transformers not installed.")
        return

    logger.info("Training BERTopic on %d promises…", len(texts))
    embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    topic_model = BERTopic(
        embedding_model=embedding_model,
        nr_topics=BERTOPIC_NR_TOPICS,
        min_topic_size=BERTOPIC_MIN_TOPIC,
        language="multilingual",
        verbose=False,
    )
    topic_model.fit_transform(texts)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    topic_model.save(str(MODEL_DIR), serialization="pickle", save_ctfidf=True)
    logger.info("BERTopic model saved to %s", MODEL_DIR)
    log_etl_event("bertopic_train_complete", n_topics=BERTOPIC_NR_TOPICS, n_docs=len(texts))


def classify_promises(df: pd.DataFrame) -> pd.DataFrame:
    """
    Assign domain labels to each promise using BERTopic (or keyword fallback).

    Args:
        df: DataFrame with `promise_text_clean` column.

    Returns:
        Same DataFrame with `domain` and `domain_confidence` columns populated.
    """
    if df.empty:
        return df

    df = df.copy()
    topics, confidences = _predict_domains(df["promise_text_clean"].fillna("").tolist())
    df["domain"]             = topics
    df["domain_confidence"]  = confidences
    return df


# ---------------------------------------------------------------------------
# Prediction helpers
# ---------------------------------------------------------------------------

def _predict_domains(texts: list[str]) -> tuple[list[str], list[float]]:
    """
    Predict domain + confidence for a list of texts.
    Tries BERTopic first, falls back to keyword matching.
    """
    model = _load_bertopic_model()
    if model is not None:
        return _predict_with_bertopic(model, texts)
    return _predict_with_keywords(texts)


def _predict_with_bertopic(model: Any, texts: list[str]) -> tuple[list[str], list[float]]:
    """Run BERTopic inference and map topic IDs → domain labels."""
    try:
        topic_ids, probs = model.transform(texts)
        domains:     list[str]   = []
        confidences: list[float] = []

        for tid, prob_arr in zip(topic_ids, probs):
            domain = _topic_to_domain(model, tid)
            # BERTopic probability for the assigned topic
            conf = float(prob_arr[tid]) if hasattr(prob_arr, "__len__") and tid >= 0 else 0.5
            conf = max(KEYWORD_FALLBACK_CONF, min(0.95, conf))
            domains.append(domain)
            confidences.append(round(conf, 3))

        return domains, confidences

    except Exception as exc:
        logger.warning("BERTopic transform failed (%s) — falling back to keywords.", exc)
        return _predict_with_keywords(texts)


def _predict_with_keywords(texts: list[str]) -> tuple[list[str], list[float]]:
    """Keyword-matching fallback when BERTopic model is unavailable."""
    domains:     list[str]   = []
    confidences: list[float] = []
    for text in texts:
        domain, conf = _infer_domain(text)
        domains.append(domain)
        confidences.append(conf if conf > 0.3 else KEYWORD_FALLBACK_CONF)
    return domains, confidences


def _topic_to_domain(model: Any, topic_id: int) -> str:
    """
    Map a BERTopic topic_id to a domain label using keyword overlap.

    Retrieves the top words for the topic and checks overlap with DOMAIN_KEYWORDS.
    Falls back to 'otro' if no domain exceeds the keyword overlap threshold.
    """
    if topic_id < 0:  # BERTopic uses -1 for outlier topic
        return "otro"

    try:
        topic_words = [word for word, _ in model.get_topic(topic_id)]
    except Exception:
        return "otro"

    topic_text = " ".join(topic_words).lower()
    best_domain = "otro"
    best_hits   = 0

    for domain, keywords in DOMAIN_KEYWORDS.items():
        if domain == "otro":
            continue
        hits = sum(1 for kw in keywords if kw in topic_text)
        if hits > best_hits:
            best_hits  = hits
            best_domain = domain

    return best_domain


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------

_bertopic_model = None
_bertopic_load_failed = False


def _load_bertopic_model() -> Any | None:
    """Lazy-load BERTopic model. Returns None if unavailable."""
    global _bertopic_model, _bertopic_load_failed
    if _bertopic_load_failed:
        return None
    if _bertopic_model is not None:
        return _bertopic_model

    if not MODEL_DIR.exists():
        logger.info("BERTopic model directory not found — using keyword fallback.")
        _bertopic_load_failed = True
        return None

    try:
        from bertopic import BERTopic
        _bertopic_model = BERTopic.load(str(MODEL_DIR))
        logger.info("Loaded BERTopic model from %s", MODEL_DIR)
        return _bertopic_model
    except Exception as exc:
        logger.warning("BERTopic load failed (%s) — using keyword fallback.", exc)
        _bertopic_load_failed = True
        return None


# ---------------------------------------------------------------------------
# Any-type annotation helper (avoids import at module level)
# ---------------------------------------------------------------------------

from typing import Any  # noqa: E402 (must be after other imports for clarity)


# ---------------------------------------------------------------------------
# Parquet I/O
# ---------------------------------------------------------------------------

def _load_promises() -> pd.DataFrame:
    if not PROMISES_PATH.exists():
        logger.error("promises.parquet not found: %s — run promise_extractor first.", PROMISES_PATH)
        return pd.DataFrame()
    return pd.read_parquet(PROMISES_PATH, engine="pyarrow")


def _save_promises(df: pd.DataFrame) -> None:
    PROMISES_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(PROMISES_PATH, engine="pyarrow", compression="snappy", index=False)
    logger.info("Updated promises.parquet: %d rows → %s", len(df), PROMISES_PATH)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train or run promise domain classifier.")
    parser.add_argument(
        "--action",
        choices=["train", "classify"],
        required=True,
        help="'train' fits a new BERTopic model; 'classify' labels existing promises.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    df = _load_promises()
    if df.empty:
        print("No promises found. Run promise_extractor first.")
    elif args.action == "train":
        train_classifier(df)
        print("BERTopic training complete.")
    else:
        df_labeled = classify_promises(df)
        _save_promises(df_labeled)
        domain_counts = df_labeled["domain"].value_counts().to_dict()
        print(f"Classified {len(df_labeled)} promises. Domains: {domain_counts}")
