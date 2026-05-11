"""Run the NLP + embedding pipeline over unprocessed articles."""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Alert, Article, Entity, Watchlist
from ..services import graph_service, nlp_service
from ..services.embedding_service import embed

log = logging.getLogger(__name__)


def _summarise(text: str, max_sentences: int = 2) -> str:
    """Cheap extractive summary — first N sentences. Used as a fallback when no AI key is set."""
    import re
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    return " ".join(sentences[:max_sentences])[:600]


def process_article(db: Session, article: Article) -> None:
    if article.processed:
        return

    result = nlp_service.analyze(f"{article.title}. {article.content}")
    article.sentiment = result.sentiment
    article.summary = article.summary or _summarise(article.content)
    article.embedding = embed(article.title + ". " + article.content[:2000])

    # Upsert entities + article_entity links.
    name_to_id: dict[str, str] = {}
    for ent_mention, occurrences in result.entities:
        ent = graph_service.upsert_entity(db, ent_mention.name, ent_mention.name_norm, ent_mention.type)
        ent.mentions = (ent.mentions or 0) + occurrences
        if not ent.embedding:
            ent.embedding = embed(ent.name)
        graph_service.upsert_article_entity(db, article.id, ent.id, occurrences)
        name_to_id[ent_mention.name_norm] = ent.id

    # Relationships.
    observed = article.published_at or article.created_at
    for rel in result.relationships:
        sid = name_to_id.get(rel.source)
        tid = name_to_id.get(rel.target)
        if not sid or not tid or sid == tid:
            continue
        graph_service.upsert_relationship(
            db, sid, tid, rel.relation_type, rel.confidence, article.id, observed
        )

    # Watchlist alerts: any watched entity mentioned in this article triggers one alert.
    if name_to_id:
        watched_entity_ids = set(name_to_id.values())
        watches = db.execute(
            select(Watchlist).where(Watchlist.entity_id.in_(watched_entity_ids))
        ).scalars().all()
        for w in watches:
            db.add(Alert(
                user_id=w.user_id, entity_id=w.entity_id, article_id=article.id,
                reason=f"Watched entity mentioned in '{article.title[:80]}'",
            ))

    article.processed = True
    db.commit()


def process_unprocessed(db: Session, limit: int = 50) -> int:
    pending = db.execute(
        select(Article).where(Article.processed.is_(False)).limit(limit)
    ).scalars().all()
    n = 0
    for a in pending:
        try:
            process_article(db, a)
            n += 1
        except Exception as e:
            log.exception("process failed for %s: %s", a.id, e)
            db.rollback()
    return n
