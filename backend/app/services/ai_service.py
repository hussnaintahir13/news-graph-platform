"""AI summaries / Q&A. Uses OpenAI when configured; deterministic extractive fallback otherwise."""
from __future__ import annotations

import logging
import re
from collections import Counter
from typing import Iterable

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Article, ArticleEntity, Entity, Relationship_
from ..schemas import ArticleOut, AskResponse, EntityOut, HypothesisResponse, PairAnalysis
from ..services import graph_service
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
    try:
        arts = db.execute(
            select(Article)
            .join(ArticleEntity, ArticleEntity.article_id == Article.id)
            .where(ArticleEntity.entity_id == entity.id)
            .order_by(Article.created_at.desc())
            .limit(8)
        ).scalars().all()
    except Exception as e:
        log.exception("summarise_entity query failed: %s", e)
        return ""
    blurb = " ".join((a.summary or (a.content or "")[:400]) for a in arts)[:3500]
    if not blurb:
        return ""
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


def scoped_summary(
    db: Session,
    subject_id: str,
    relationship_ids: list[str],
    entity_ids: list[str],
    rel_type_filter: str | None,
    entity_type_filter: str | None,
) -> AskResponse:
    """Summary scoped to the currently-visible subgraph on /explore.

    Articles are drawn ONLY from the edges that survived the filters. If no
    edges are in scope (e.g. user has filtered everything out) the answer
    explicitly says so, instead of falling back to a global summary.
    """
    subject = db.get(Entity, subject_id)
    if not subject:
        return AskResponse(answer="Subject entity not found.", sources=[], entities=[])

    # 1) Collect article IDs from the visible edges.
    article_ids: set[str] = set()
    if relationship_ids:
        rels = db.execute(
            select(Relationship_).where(Relationship_.id.in_(relationship_ids))
        ).scalars().all()
        for r in rels:
            if r.article_id:
                article_ids.add(r.article_id)

    # 2) Fallback to the subject's own articles only when NOTHING in the view
    #    has an article reference — keeps the summary scoped while preventing
    #    a totally empty result on a freshly-seeded entity.
    using_fallback = False
    if not article_ids:
        using_fallback = True
        rows = db.execute(
            select(ArticleEntity.article_id)
            .where(ArticleEntity.entity_id == subject_id)
            .limit(8)
        ).scalars().all()
        article_ids = set(rows)

    if not article_ids:
        return AskResponse(
            answer=(
                f"No articles match the current filters for {subject.name}. "
                "Relax the filters above or ingest more sources from the Admin page."
            ),
            sources=[], entities=[],
        )

    articles = db.execute(
        select(Article).where(Article.id.in_(article_ids))
        .order_by(Article.published_at.desc().nulls_last(), Article.created_at.desc())
        .limit(8)
    ).scalars().all()

    visible_entities: list[Entity] = []
    if entity_ids:
        ent_ids = [i for i in entity_ids if i != subject_id]
        if ent_ids:
            visible_entities = db.execute(
                select(Entity).where(Entity.id.in_(ent_ids)).order_by(Entity.mentions.desc()).limit(6)
            ).scalars().all()

    # 3) Describe the filter state in plain English for both prompt + UI.
    filter_bits: list[str] = []
    if rel_type_filter and rel_type_filter != "ALL":
        filter_bits.append(f"only via {rel_type_filter.lower().replace('_', ' ')} relationships")
    if entity_type_filter and entity_type_filter != "ALL":
        filter_bits.append(f"limited to {entity_type_filter} entities")
    filter_phrase = (" — " + " and ".join(filter_bits)) if filter_bits else ""

    context_lines = [f"- {a.title}: {(a.summary or (a.content or '')[:300])}" for a in articles]
    context = "\n".join(context_lines)
    prefix_note = "(no edges in the filtered view carried article references, so we drew from the subject's article set instead) " if using_fallback else ""

    openai_ans = _openai_chat([
        {
            "role": "system",
            "content": (
                "You are a careful news analyst. Summarise ONLY what the articles below say about the named entity. "
                "Stay strictly within the provided context — do not introduce outside knowledge. Hedge where the evidence is thin."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Summarise what these news articles say about {subject.name}{filter_phrase}, in 2-3 sentences.\n\n"
                f"Articles:\n{context}"
            ),
        },
    ])

    if openai_ans:
        answer = prefix_note + openai_ans
    else:
        # Deterministic structured fallback. Reads like a summary, not a quoted article body.
        answer = prefix_note + _scoped_deterministic(
            subject_name=subject.name,
            filter_phrase=filter_phrase,
            articles=articles,
            others=visible_entities,
        )

    return AskResponse(
        answer=answer,
        sources=[ArticleOut.model_validate(a) for a in articles],
        entities=[EntityOut.model_validate(e) for e in visible_entities],
    )


def _scoped_deterministic(subject_name: str, filter_phrase: str, articles: list[Article], others: list[Entity]) -> str:
    """Compose a readable scoped summary without an LLM.

    Format:
        In the current view{filter_phrase}, {subject} is connected to {N} entities
        (X, Y, Z and N more). The {M} articles supporting this view discuss:
          • <lede sentence of article 1>
          • <lede sentence of article 2>
    """
    parts: list[str] = []
    intro = f"In the current view{filter_phrase}, **{subject_name}**"
    n = len(others)
    if n == 0:
        parts.append(intro + " has no other entities in scope.")
    else:
        names = [e.name for e in others[:5]]
        if n == 1:
            parts.append(f"{intro} is connected to **{names[0]}**.")
        elif n <= 5:
            parts.append(f"{intro} is connected to " + ", ".join(f"**{x}**" for x in names[:-1]) + f" and **{names[-1]}**.")
        else:
            head = ", ".join(f"**{x}**" for x in names)
            parts.append(f"{intro} is connected to **{n}** entities, including {head}.")

    if articles:
        plural = "s" if len(articles) > 1 else ""
        parts.append(f" The {len(articles)} article{plural} supporting this view discuss:")
        for a in articles[:3]:
            sentences = _split_sentences(a.content or "")
            if not sentences:
                continue
            lede = sentences[0].strip()
            if len(lede) > 180:
                lede = lede[:180].rsplit(" ", 1)[0] + "…"
            parts.append(f"\n• {lede}")

    return "".join(parts)


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


def build_hypothesis(db: Session, entity_ids: list[str], max_hops: int = 3, max_paths_per_pair: int = 3) -> HypothesisResponse:
    """Analyse paths between every pair of seed entities; produce a narrative + supporting articles."""
    if len(entity_ids) < 2:
        return HypothesisResponse(
            statement="Select at least two entities to analyse a connection.",
            pairs=[], supporting_articles=[],
        )

    ent_rows = db.execute(select(Entity).where(Entity.id.in_(entity_ids))).scalars().all()
    entity_map = {e.id: e for e in ent_rows}

    # Build adjacency once, reuse for every pair.
    adj = graph_service._load_adjacency(db)

    pair_analyses: list[PairAnalysis] = []
    all_article_ids: set[str] = set()

    for i in range(len(entity_ids)):
        for j in range(i + 1, len(entity_ids)):
            a_id, b_id = entity_ids[i], entity_ids[j]
            paths_edges = graph_service.find_paths(db, a_id, b_id, max_hops=max_hops, max_paths=max_paths_per_pair, adj=adj)
            path_infos = [graph_service.edges_to_path_info(p, a_id, b_id, entity_map) for p in paths_edges]
            for p in paths_edges:
                for edge in p:
                    if edge.article_id:
                        all_article_ids.add(edge.article_id)
            pair_analyses.append(PairAnalysis(
                from_id=a_id,
                from_name=entity_map[a_id].name if a_id in entity_map else None,
                to_id=b_id,
                to_name=entity_map[b_id].name if b_id in entity_map else None,
                paths=path_infos,
                direct=any(p.length == 1 for p in path_infos),
                indirect=any(p.length > 1 for p in path_infos),
            ))

    # Supporting articles, in recency order.
    articles: list[Article] = []
    if all_article_ids:
        articles = db.execute(
            select(Article).where(Article.id.in_(all_article_ids))
            .order_by(Article.published_at.desc().nulls_last(), Article.created_at.desc())
            .limit(15)
        ).scalars().all()

    statement = _build_deterministic_narrative(pair_analyses)
    ai_used = False
    polished = _polish_with_openai(statement, pair_analyses, articles)
    if polished:
        statement = polished
        ai_used = True

    return HypothesisResponse(
        statement=statement,
        pairs=pair_analyses,
        supporting_articles=[ArticleOut.model_validate(a) for a in articles],
        ai_generated=ai_used,
    )


def _build_deterministic_narrative(pairs: list[PairAnalysis]) -> str:
    parts: list[str] = []
    no_link: list[tuple[str, str]] = []
    for p in pairs:
        a = p.from_name or p.from_id
        b = p.to_name or p.to_id
        direct_paths = [x for x in p.paths if x.length == 1]
        indirect_paths = [x for x in p.paths if x.length > 1]

        if direct_paths:
            top = direct_paths[0]
            verb = (top.steps[0].relation_type if top.steps else "MENTIONED_WITH").lower().replace("_", " ")
            parts.append(f"**{a}** and **{b}** are directly linked ({verb}).")
        elif indirect_paths:
            shortest = indirect_paths[0]
            chain = " → ".join(shortest.chain_names)
            via = " and ".join(shortest.chain_names[1:-1]) or "an intermediate entity"
            parts.append(
                f"**{a}** and **{b}** have no direct link in the index, but they connect via {via}: {chain}. "
                f"This suggests {a} may be linked to {b} through {via.split(' and ')[0]}."
            )
        else:
            no_link.append((a, b))

    if no_link:
        for a, b in no_link:
            parts.append(f"No path was found between **{a}** and **{b}** within {3} hops — they appear unrelated in the current index.")

    if not parts:
        return "Select at least two entities to analyse a connection."
    return " ".join(parts)


def _polish_with_openai(statement: str, pairs: list[PairAnalysis], articles: Iterable[Article]) -> str | None:
    if not settings.openai_api_key:
        return None

    # Build evidence context
    evidence_lines: list[str] = []
    for p in pairs:
        a = p.from_name or p.from_id
        b = p.to_name or p.to_id
        for path in p.paths[:3]:
            chain = " -> ".join(path.chain_names)
            verbs = ", ".join(s.relation_type.lower().replace("_", " ") for s in path.steps)
            evidence_lines.append(f"- {a} to {b}: chain {chain} (relations: {verbs})")

    article_lines = []
    for a in list(articles)[:8]:
        snippet = (a.summary or (a.content or "")[:200]).replace("\n", " ")
        article_lines.append(f"- {a.title}: {snippet}")

    user_prompt = (
        "Below is a deterministic connection analysis and the supporting news articles. "
        "Write a clear 2-3 sentence hypothesis about how the entities might be related. "
        "Stay grounded in the evidence; if a connection is only indirect, say so explicitly.\n\n"
        f"Deterministic analysis:\n{statement}\n\n"
        f"Path evidence:\n" + "\n".join(evidence_lines) + "\n\n"
        f"Supporting articles:\n" + "\n".join(article_lines)
    )
    return _openai_chat([
        {"role": "system", "content": "You are a careful news analyst. Only state what the evidence supports. Hedge appropriately."},
        {"role": "user", "content": user_prompt}
    ])
