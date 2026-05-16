"""Search: SQL LIKE for keyword, cosine for semantic, name match for entity.

For larger scale, swap to SQLite FTS5 or Elasticsearch by re-implementing this module.
"""
from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..models import Article, Entity
from ..schemas import SearchHit
from ..services.embedding_service import cosine, embed_query


def search(db: Session, q: str, mode: str, limit: int) -> list[SearchHit]:
    q = (q or "").strip()
    if not q:
        return []
    if mode == "entity":
        return _entity(db, q, limit)
    if mode == "semantic":
        return _semantic(db, q, limit)
    return _keyword(db, q, limit)


def _keyword(db: Session, q: str, limit: int) -> list[SearchHit]:
    like = f"%{q}%"
    rows = db.execute(
        select(Article).where(or_(Article.title.ilike(like), Article.content.ilike(like)))
        .order_by(Article.created_at.desc()).limit(limit)
    ).scalars().all()
    return [
        SearchHit(kind="article", id=r.id, title=r.title, snippet=_snippet(r.content, q), score=1.0)
        for r in rows
    ]


def _entity(db: Session, q: str, limit: int) -> list[SearchHit]:
    like = f"%{q.lower()}%"
    rows = db.execute(
        select(Entity).where(Entity.name_norm.ilike(like))
        .order_by(Entity.mentions.desc()).limit(limit)
    ).scalars().all()
    return [SearchHit(kind="entity", id=e.id, title=f"{e.name} ({e.type})", score=float(e.mentions)) for e in rows]


def _semantic(db: Session, q: str, limit: int) -> list[SearchHit]:
    # Query goes through embed_query — for bge-style models this prepends the
    # retrieval instruction prefix so query↔passage cosines match the training
    # objective. For MiniLM-style models embed_query is equivalent to embed.
    qv = embed_query(q)
    if not qv:
        return []
    rows = db.execute(
        select(Article).where(Article.embedding.is_not(None))
        .order_by(Article.created_at.desc()).limit(500)
    ).scalars().all()
    scored = [(r, cosine(qv, r.embedding)) for r in rows]
    scored.sort(key=lambda x: x[1], reverse=True)
    return [
        SearchHit(kind="article", id=r.id, title=r.title, snippet=_snippet(r.content, q), score=float(s))
        for r, s in scored[:limit] if s > 0
    ]


def _snippet(text: str, q: str, length: int = 220) -> str:
    if not text:
        return ""
    idx = text.lower().find(q.lower())
    if idx < 0:
        return text[:length] + ("…" if len(text) > length else "")
    start = max(0, idx - 60)
    end = min(len(text), idx + length - 60)
    s = text[start:end]
    if start > 0:
        s = "…" + s
    if end < len(text):
        s = s + "…"
    return s
