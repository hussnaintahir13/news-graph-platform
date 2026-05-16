"""Embedding service — primary model with automatic fallback.

NewroSense defaults to ``BAAI/bge-small-en-v1.5`` (384-dim) which scores ~10–15 MTEB
points higher than the historical MiniLM-L6 default. If the primary cannot be loaded
(no network, Hugging Face unavailable, restricted environment, ``EMBEDDING_FORCE_FALLBACK``
set, etc.) the service transparently falls back to
``sentence-transformers/all-MiniLM-L6-v2`` — same 384-dim space, so existing cosine
scores remain comparable.

Public API (unchanged signatures, so the rest of the codebase keeps working):
    embed(text)             — document / passage embedding
    embed_many(texts)       — batched document embeddings
    embed_query(text)       — query embedding (bge-style instruction prefix when supported)
    cosine(a, b)            — cosine similarity
    model_info()            — diagnostic dict: which model is actually loaded
"""
from __future__ import annotations

import logging
import math
import threading
from dataclasses import dataclass
from typing import Iterable

import numpy as np

from ..config import settings

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------
# bge-small-en-v1.5 was trained with an instruction prefix on the QUERY side only.
# Passages / documents are encoded without a prefix. See:
#   https://huggingface.co/BAAI/bge-small-en-v1.5
_BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "


@dataclass
class _LoadedModel:
    name: str               # the model identifier actually loaded
    is_primary: bool        # True = primary model, False = fallback active
    query_prefix: str       # prepended to queries before encoding ("" for fallback)
    instance: object        # the SentenceTransformer instance

    def encode(self, texts, *, normalize: bool, batch: bool):
        if batch:
            return self.instance.encode(
                texts, normalize_embeddings=normalize, batch_size=32, show_progress_bar=False,
            )
        return self.instance.encode(texts, normalize_embeddings=normalize)


_state_lock = threading.Lock()
_loaded: _LoadedModel | None = None


def _try_load(model_name: str, is_primary: bool) -> _LoadedModel | None:
    """Attempt to load ``model_name``. Returns None on any failure (caller handles fallback)."""
    try:
        # Lazy import — sentence-transformers pulls torch and is heavy.
        from sentence_transformers import SentenceTransformer  # noqa: WPS433
    except Exception as e:  # pragma: no cover — only on broken installs
        log.error("sentence-transformers not importable: %s", e)
        return None

    try:
        instance = SentenceTransformer(model_name)
    except Exception as e:
        log.warning(
            "embedding model %s could not be loaded (%s). %s",
            model_name, e,
            "Falling back." if is_primary else "No further fallback available.",
        )
        return None

    # bge-style models want a query prefix for retrieval queries. MiniLM does not.
    use_prefix = "bge" in model_name.lower()
    return _LoadedModel(
        name=model_name,
        is_primary=is_primary,
        query_prefix=_BGE_QUERY_PREFIX if use_prefix else "",
        instance=instance,
    )


def _model() -> _LoadedModel | None:
    """Return the loaded model, loading on first call. Thread-safe."""
    global _loaded
    if _loaded is not None:
        return _loaded
    with _state_lock:
        if _loaded is not None:  # double-checked locking
            return _loaded

        primary = settings.embedding_model
        fallback = settings.embedding_fallback_model

        if not settings.embedding_force_fallback:
            loaded = _try_load(primary, is_primary=True)
            if loaded is not None:
                log.info("embedding model loaded: %s (primary)", loaded.name)
                _loaded = loaded
                return _loaded
        else:
            log.info("EMBEDDING_FORCE_FALLBACK=true — skipping primary %s", primary)

        if fallback and fallback != primary:
            loaded = _try_load(fallback, is_primary=False)
            if loaded is not None:
                log.warning("embedding model loaded: %s (fallback)", loaded.name)
                _loaded = loaded
                return _loaded

        log.error(
            "neither primary (%s) nor fallback (%s) embedding models could be loaded. "
            "Embeddings will be empty until a model is available.",
            primary, fallback,
        )
        return None


def warmup() -> None:
    """Eagerly load the embedding model (call from app startup if you want to pay the cost up-front)."""
    _model()


def model_info() -> dict:
    """Diagnostic info for `/api/health/embedding` and similar endpoints."""
    m = _model()
    if m is None:
        return {
            "loaded": False,
            "primary": settings.embedding_model,
            "fallback": settings.embedding_fallback_model,
        }
    return {
        "loaded": True,
        "model": m.name,
        "is_primary": m.is_primary,
        "uses_query_prefix": bool(m.query_prefix),
    }


# ---------------------------------------------------------------------------
# Public encoding API
# ---------------------------------------------------------------------------
def embed(text: str) -> list[float]:
    """Embed a single passage / document. Returns [] on empty input or model failure."""
    if not text:
        return []
    m = _model()
    if m is None:
        return []
    vec = m.encode(text, normalize=True, batch=False)
    return np.asarray(vec, dtype=float).tolist()


def embed_many(texts: Iterable[str]) -> list[list[float]]:
    """Batched passage embeddings. Empty inputs are filtered out (the result tracks the
    filtered input order; callers needing alignment with originals should pre-filter)."""
    items = [t for t in texts if t]
    if not items:
        return []
    m = _model()
    if m is None:
        return [[] for _ in items]
    vecs = m.encode(items, normalize=True, batch=True)
    return [np.asarray(v, dtype=float).tolist() for v in vecs]


def embed_query(text: str) -> list[float]:
    """Embed a search query.

    For bge-style models the canonical query instruction is prepended so that
    query↔passage cosines match how the model was trained. For models without a query
    prefix this is equivalent to :func:`embed`.
    """
    if not text:
        return []
    m = _model()
    if m is None:
        return []
    payload = (m.query_prefix + text) if m.query_prefix else text
    vec = m.encode(payload, normalize=True, batch=False)
    return np.asarray(vec, dtype=float).tolist()


# ---------------------------------------------------------------------------
# Similarity
# ---------------------------------------------------------------------------
def cosine(a: list[float] | None, b: list[float] | None) -> float:
    if not a or not b:
        return 0.0
    av, bv = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    if av.shape != bv.shape:
        # Defensive: a model swap could produce mismatched dimensions across vectors
        # produced at different times. Treat as no signal rather than crashing.
        return 0.0
    na, nb = np.linalg.norm(av), np.linalg.norm(bv)
    if na == 0 or nb == 0 or math.isnan(na) or math.isnan(nb):
        return 0.0
    return float(np.dot(av, bv) / (na * nb))
