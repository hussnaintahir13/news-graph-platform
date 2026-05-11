"""Chained-evidence argument construction.

Given a SUBJECT, an OUTCOME, and an optional THEME, this service:
  1. Finds paths through the graph from subject → outcome (preferring those
     that pass through the theme if specified).
  2. Rejects any chain that contains MENTIONED_WITH edges or whose weakest
     edge falls below the minimum confidence threshold.
  3. Extracts the exact sentence from the source article that produced
     each edge so the user can audit the chain.
  4. Picks a sentence template from a small fixed taxonomy, fills it with
     the entity names, and emits a hedged conclusion (always "may have",
     never "is").

This is deliberately conservative — most calls will return
``can_construct=False`` with a reason, because the cue-based relation
extractor in the MVP only fires for a handful of verbs. That's the point.
"""
from __future__ import annotations

import logging
import re
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Article, Entity, Relationship_
from ..schemas import ArgumentPremise, ArgumentResponse, ArticleOut
from ..services import graph_service

log = logging.getLogger(__name__)


# ---------- Edge / chain helpers ----------
CUE_TYPES = {"ACQUIRED", "INVESTED_IN", "PARTNERED", "ANNOUNCED", "REGULATED", "ATTACKED", "SUED"}
# Verbs that indicate the OUTCOME is something harmful or directional.
HARM_TYPES = {"ATTACKED", "SUED", "REGULATED"}


def _decline(reason: str, subject: Entity | None = None, outcome: Entity | None = None, theme: Entity | None = None) -> ArgumentResponse:
    return ArgumentResponse(
        can_construct=False,
        decline_reason=reason,
        subject_name=subject.name if subject else None,
        outcome_name=outcome.name if outcome else None,
        theme_name=theme.name if theme else None,
    )


def _walk_chain(src_id: str, edges: list[Relationship_]) -> list[str]:
    """Return the ordered list of entity IDs along an undirected edge path starting at src_id."""
    chain = [src_id]
    current = src_id
    for e in edges:
        nxt = e.target_entity if e.source_entity == current else e.source_entity
        chain.append(nxt)
        current = nxt
    return chain


def _find_quote(content: str, name_a: str, name_b: str, max_len: int = 240) -> str | None:
    if not content:
        return None
    sentences = re.split(r"(?<=[.!?])\s+", content)
    a, b = name_a.lower(), name_b.lower()
    for s in sentences:
        sl = s.lower()
        if a in sl and b in sl:
            return s.strip()[:max_len]
    # Fallback — sentence containing just name_a (closer to the subject).
    for s in sentences:
        if a in s.lower():
            return s.strip()[:max_len]
    return None


# ---------- Templates ----------
def _categorise(rel_types: list[str], has_theme: bool, harm_outcome: bool) -> tuple[str, str]:
    """Return (template_name, template_text_with_placeholders)."""
    has_acq      = "ACQUIRED" in rel_types
    has_partner  = "PARTNERED" in rel_types
    has_invest   = "INVESTED_IN" in rel_types
    has_attack   = "ATTACKED" in rel_types
    has_sue      = "SUED" in rel_types
    has_regulate = "REGULATED" in rel_types

    if harm_outcome and (has_partner or has_acq or has_invest):
        return (
            "facilitation",
            "Based on the news chain above, {subject} may have facilitated or enabled actions linked to {outcome}{theme_clause}. This is a hedged inference; absence of a direct edge means the claim is indirect.",
        )
    if has_attack or has_sue or has_regulate:
        return (
            "association",
            "{subject} may be associated with the events surrounding {outcome}{theme_clause}, per the chain above. Co-occurrence in news does not by itself establish causation.",
        )
    if has_invest and has_acq:
        return (
            "beneficiary",
            "{subject} may stand to benefit from {outcome}{theme_clause}, based on the investment and acquisition links shown above.",
        )
    if has_partner:
        return (
            "collaboration",
            "{subject} appears to be in a collaborative relationship with the parties leading to {outcome}{theme_clause}.",
        )
    return (
        "linkage",
        "{subject} has an indirect link to {outcome}{theme_clause}, based on the news chain above. This is a weak inference suitable only as a starting point for research.",
    )


def _confidence_band(min_conf: float) -> Literal["very-low", "low", "moderate", "high"]:
    if min_conf >= 0.75:
        return "high"
    if min_conf >= 0.6:
        return "moderate"
    if min_conf >= 0.5:
        return "low"
    return "very-low"


# ---------- Main ----------
def build_argument(
    db: Session,
    subject_id: str,
    outcome_id: str,
    theme_id: str | None,
    max_hops: int = 4,
    min_confidence: float = 0.5,
) -> ArgumentResponse:
    subject = db.get(Entity, subject_id)
    outcome = db.get(Entity, outcome_id)
    theme = db.get(Entity, theme_id) if theme_id else None
    if not subject or not outcome:
        return _decline("Subject or outcome entity not found.")
    if subject_id == outcome_id:
        return _decline("Subject and outcome must be different entities.", subject, outcome, theme)

    # Find candidate paths.
    adj = graph_service._load_adjacency(db)
    paths = graph_service.find_paths(db, subject_id, outcome_id, max_hops=min(4, max(2, max_hops)), max_paths=20, adj=adj)
    if not paths:
        return _decline(
            "No path was found between these entities in the index. Try increasing the hop limit or ingesting more sources.",
            subject, outcome, theme,
        )

    # Prefer paths that pass through the theme if specified.
    if theme_id:
        through_theme = [p for p in paths if any(e.source_entity == theme_id or e.target_entity == theme_id for e in p)]
        if through_theme:
            paths = through_theme

    # Filter: only cue-typed edges allowed, and every edge must meet the confidence floor.
    best: list[Relationship_] | None = None
    for p in paths:
        types = [e.relation_type for e in p]
        if any(t not in CUE_TYPES for t in types):
            continue
        if min(e.confidence for e in p) < min_confidence:
            continue
        if best is None or len(p) < len(best):
            best = p

    if not best:
        return _decline(
            "Could not construct an argument: every candidate chain contains weak (MENTIONED_WITH) edges or falls below the confidence floor. "
            "This is intentional — the platform refuses to assemble claims out of mere co-mentions. "
            "Add more news sources for richer extraction, or lower the confidence threshold if you understand the trade-off.",
            subject, outcome, theme,
        )

    # Build the chain.
    chain_ids = _walk_chain(subject_id, best)
    ent_rows = db.execute(select(Entity).where(Entity.id.in_(set(chain_ids)))).scalars().all()
    ent_map = {e.id: e for e in ent_rows}
    chain_names = [ent_map[i].name for i in chain_ids if i in ent_map]

    # Premises with audited quotes.
    premises: list[ArgumentPremise] = []
    article_ids_used: set[str] = set()
    walker = subject_id
    for i, edge in enumerate(best):
        nxt = edge.target_entity if edge.source_entity == walker else edge.source_entity
        article = db.get(Article, edge.article_id) if edge.article_id else None
        a_name = ent_map[walker].name if walker in ent_map else walker
        b_name = ent_map[nxt].name if nxt in ent_map else nxt
        quote = _find_quote(article.content if article else "", a_name, b_name) if article else None
        if article and article.id:
            article_ids_used.add(article.id)
        premises.append(ArgumentPremise(
            n=i + 1,
            source_name=a_name,
            target_name=b_name,
            relation_type=edge.relation_type,
            relation_verb=edge.relation_type.lower().replace("_", " "),
            confidence=edge.confidence,
            article_id=edge.article_id,
            article_title=article.title if article else None,
            article_quote=quote,
        ))
        walker = nxt

    # Conclusion template.
    rel_types = [p.relation_type for p in premises]
    harm_outcome = any(t in HARM_TYPES for t in rel_types)
    template_name, template_text = _categorise(rel_types, theme is not None, harm_outcome)
    theme_clause = f" via {theme.name}" if theme else ""
    conclusion = template_text.format(
        subject=subject.name, outcome=outcome.name, theme_clause=theme_clause,
    )

    band = _confidence_band(min(p.confidence for p in premises))

    articles: list[Article] = []
    if article_ids_used:
        articles = db.execute(select(Article).where(Article.id.in_(article_ids_used))).scalars().all()

    return ArgumentResponse(
        can_construct=True,
        subject_name=subject.name,
        outcome_name=outcome.name,
        theme_name=theme.name if theme else None,
        chain_names=chain_names,
        premises=premises,
        conclusion=conclusion,
        conclusion_template=template_name,
        confidence_band=band,
        supporting_articles=[ArticleOut.model_validate(a) for a in articles],
    )
