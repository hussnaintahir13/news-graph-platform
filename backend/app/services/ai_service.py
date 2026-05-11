"""AI summaries / Q&A. Uses OpenAI when configured; deterministic extractive fallback otherwise."""
from __future__ import annotations

import logging
import re
from collections import Counter
from typing import Iterable

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Article, Entity, Relationship_
from ..schemas import ArticleOut, AskResponse, EntityOut
from ..services.embedding_service import cosine, embed
from ..services.search_service import _semantic

log = logging.getLogger(__name__)


def _split_sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text or "") if s.strip()]


def _extractive_summary(text: str, max_sentences: int = 3) -> str:
    sents = _split_sentences(text)
    if not sents:
        return ""
    # Score sentences by token frequency (very small TF heuristic).
    words = re.findall(r"[A-Za-z']+", text.lower())
    stop = {"the", "a", "an", "and", "of", "in", "to", "is", "for", "on", "with", "by", "at", "as", "from"}
    freq = Counter(w for w in words if w not in stop and len(w) > 2)
    scored = sorted(
        ((sum(freq.get(w.lower(), 0) for w in re.findall(r"[A-Za-z']+", s)), i, s) for i, s in enumerate(sents)),
        reverse=True,
    )
    top = sorted(scored[:max_sentences], key=lambda x: x[1])
    return " ".join(s for _, _, s in top)[:800]


def _openai_chat(messages: list[dict]) -> str | None:
    if not settings.openai_api_key:
        return None
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.openai_api_key)
        resp = client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            temperature=0.2,
            max_tokens=400,
        )
        return resp.choices[0].message.content
    except Exception as e:
        log.warning("OpenAI call failed, falling back: %s", e)
        return None


def summarise_entity(db: Session, entity: Entity) -> str:
    arts = db.execute(
        select(Article).join(Article.entities).where(Article.entities.any(entity_id=entity.id))
        .order_by(Article.created_at.desc()).limit(8)
    ).scalars().all()
    blurb = " ".join(a.summary or a.content[:400] for a in arts)[:3500]
    openai_ans = _openai_chat([
        {"role": "system", "content": "You produce concise neutral summaries of an entity from news context."},
        {"role": "user", "content": f"Entity: {entity.name} ({entity.type}).\nRecent context:\n{blurb}\n\nWrite 2-3 sentences."}
    ])
    return openai_ans or _extractive_summary(blurb)


def answer_question(db: Session, question: str) -> AskResponse:
    # 1. Pull supporting articles via semantic search.
    hits = _semantic(db, question, limit=5)
    article_ids = [h.id for h in hits]
    articles = db.execute(select(Article).where(Article.id.in_(article_ids))).scalars().all() if article_ids else []
    art_map = {a.id: a for a in articles}
    ordered_articles = [art_map[i] for i in article_ids if i in art_map]

    # 2. Try to spot named entities in the question to scope context.
    qv = embed(question)
    candidate_entities: list[tuple[Entity, float]] = []
    if qv:
        ents = db.execute(select(Entity).where(Entity.embedding.is_not(None)).limit(2000)).scalars().all()
        candidate_entities = sorted(
            ((e, cosine(qv, e.embedding)) for e in ents), key=lambda x: x[1], reverse=True
        )[:5]
    top_entities = [e for e, s in candidate_entities if s > 0.35]

    # 3. Build context blurb.
    context_pieces = []
    for a in ordered_articles[:5]:
        context_pieces.append(f"- {a.title}: {(a.summary or a.content[:300])}")
    for e in top_entities[:5]:
        context_pieces.append(f"- Entity: {e.name} ({e.type}); mentioned {e.mentions}x")
    context = "\n".join(context_pieces) or "(no matching context found)"

    openai_ans = _openai_chat([
        {"role": "system", "content": "You answer questions about news using ONLY the provided context. "
                                       "Quote source titles when possible. If unknown, say so."},
        {"role": "user", "content": f"Question: {question}\n\nContext:\n{context}"}
    ])

    if openai_ans:
        answer = openai_ans
    else:
        # Deterministic fallback.
        if not ordered_articles and not top_entities:
            answer = "No matching news found in the index for that question."
        else:
            answer = "Based on indexed news: " + _extractive_summary(context, max_sentences=3)

    return AskResponse(
        answer=answer,
        sources=[ArticleOut.model_validate(a) for a in ordered_articles],
        entities=[EntityOut.model_validate(e) for e in top_entities],
    )


def explain_relationship(db: Session, source_id: str, target_id: str) -> str:
    rels: Iterable[Relationship_] = db.execute(
        select(Relationship_).where(
            or_(
                ((Relationship_.source_entity == source_id) & (Relationship_.target_entity == target_id)),
                ((Relationship_.source_entity == target_id) & (Relationship_.target_entity == source_id)),
            )
        ).order_by(Relationship_.weight.desc()).limit(10)
    ).scalars().all()
    if not rels:
        return "No direct relationships recorded between these entities."
    lines = [
        f"{r.relation_type} (confidence {r.confidence:.2f}, weight {r.weight:.1f}, observed {r.observed_at:%Y-%m-%d})"
        for r in rels
    ]
    return "Recorded relationships:\n" + "\n".join(lines)
