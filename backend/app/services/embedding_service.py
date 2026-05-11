from __future__ import annotations

import math
from functools import lru_cache
from typing import Iterable

import numpy as np

from ..config import settings


@lru_cache(maxsize=1)
def _model():
    # Lazy import — sentence-transformers pulls torch which is heavy.
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(settings.embedding_model)


def embed(text: str) -> list[float]:
    if not text:
        return []
    vec = _model().encode(text, normalize_embeddings=True)
    return vec.astype(float).tolist()


def embed_many(texts: Iterable[str]) -> list[list[float]]:
    items = [t for t in texts if t]
    if not items:
        return []
    vecs = _model().encode(items, normalize_embeddings=True, batch_size=32, show_progress_bar=False)
    return [v.astype(float).tolist() for v in vecs]


def cosine(a: list[float] | None, b: list[float] | None) -> float:
    if not a or not b:
        return 0.0
    av, bv = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    na, nb = np.linalg.norm(av), np.linalg.norm(bv)
    if na == 0 or nb == 0 or math.isnan(na) or math.isnan(nb):
        return 0.0
    return float(np.dot(av, bv) / (na * nb))
