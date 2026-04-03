"""
Sentence-transformer singleton for VeedurIA PromesóMetro.

Provides a cached SentenceTransformer instance for use by coherence_scorer.py
and any other module that needs text embeddings.

The model is saved locally after first download so subsequent runs are offline-capable.

Model: paraphrase-multilingual-MiniLM-L12-v2
  - 118M parameters, 384-dim embeddings
  - Supports Spanish and 50+ other languages
  - Fast enough for batch inference on CPU (< 1s per 64 sentences)

Usage:
    from src.models.promise_model import get_promise_model

    model = get_promise_model()
    embeddings = model.encode(["texto 1", "texto 2"], batch_size=64, normalize_embeddings=True)

CLI (warmup + cache):
    python -m src.models.promise_model
"""

from __future__ import annotations

from pathlib import Path

from src.utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PROJECT_ROOT       = Path(__file__).resolve().parent.parent.parent
LOCAL_MODEL_DIR    = PROJECT_ROOT / "data" / "processed" / "models" / "sentence_transformer"
MODEL_NAME         = "paraphrase-multilingual-MiniLM-L12-v2"

# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_model = None
_model_load_failed = False


def get_promise_model():
    """
    Return a cached SentenceTransformer instance.

    Loads from LOCAL_MODEL_DIR if the cached model exists, otherwise downloads
    from HuggingFace and caches locally.

    Returns:
        SentenceTransformer instance, or None if loading fails.
    """
    global _model, _model_load_failed

    if _model_load_failed:
        return None
    if _model is not None:
        return _model

    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        logger.error(
            "sentence-transformers not installed. "
            "Run: pip install sentence-transformers"
        )
        _model_load_failed = True
        return None

    # Try local cache first
    if LOCAL_MODEL_DIR.exists():
        try:
            logger.info("Loading sentence-transformer from local cache: %s", LOCAL_MODEL_DIR)
            _model = SentenceTransformer(str(LOCAL_MODEL_DIR))
            logger.info("Model loaded from cache.")
            return _model
        except Exception as exc:
            logger.warning("Local cache load failed (%s) — downloading from HuggingFace.", exc)

    # Download and cache
    try:
        logger.info("Downloading %s from HuggingFace…", MODEL_NAME)
        _model = SentenceTransformer(MODEL_NAME)
        LOCAL_MODEL_DIR.mkdir(parents=True, exist_ok=True)
        _model.save(str(LOCAL_MODEL_DIR))
        logger.info("Model saved to local cache: %s", LOCAL_MODEL_DIR)
        return _model
    except Exception as exc:
        logger.error("Failed to load sentence-transformer model: %s", exc)
        _model_load_failed = True
        return None


def encode_texts(
    texts: list[str],
    batch_size: int = 64,
    normalize: bool = True,
) -> "np.ndarray | None":
    """
    Encode a list of texts into L2-normalized embeddings.

    Args:
        texts:      List of strings to encode.
        batch_size: Inference batch size.
        normalize:  If True, L2-normalize embeddings (required for cosine similarity
                    via dot product).

    Returns:
        numpy array of shape (len(texts), 384), or None if model unavailable.
    """
    import numpy as np

    model = get_promise_model()
    if model is None:
        logger.error("Sentence-transformer model unavailable — cannot encode texts.")
        return None

    if not texts:
        return np.empty((0, 384), dtype=np.float32)

    try:
        embeddings = model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=normalize,
            show_progress_bar=False,
        )
        return embeddings
    except Exception as exc:
        logger.error("Encoding failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Streamlit cache wrapper (used in pages)
# ---------------------------------------------------------------------------

def get_cached_model():
    """
    Return the module-level singleton used by the active FastAPI + Next.js
    runtime.

    This helper name is kept for compatibility with older callers, but the
    operational stack no longer depends on Streamlit caching.
    """
    return get_promise_model()


# ---------------------------------------------------------------------------
# CLI — download + cache warmup
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    logger.info("Starting model warmup for %s", MODEL_NAME)
    model = get_promise_model()
    if model is None:
        print("ERROR: Failed to load model. Check logs above.")
        sys.exit(1)

    # Smoke test
    import numpy as np
    test_texts = [
        "Garantizaremos acceso gratuito a la educación pública.",
        "Crearemos 500,000 empleos en el primer año de gobierno.",
    ]
    embeddings = encode_texts(test_texts)
    if embeddings is None:
        print("ERROR: encode_texts returned None.")
        sys.exit(1)

    assert embeddings.shape == (2, 384), f"Unexpected shape: {embeddings.shape}"
    sim = float(np.dot(embeddings[0], embeddings[1]))
    print(f"Model OK. Smoke test similarity: {sim:.4f}")
    print(f"Model cached at: {LOCAL_MODEL_DIR}")
