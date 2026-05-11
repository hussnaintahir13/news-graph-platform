"""spaCy-based NLP pipeline: NER, sentence-level co-occurrence relationships, sentiment."""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from typing import Iterable

from ..config import settings

SPACY_TO_TYPE = {
    "PERSON": "Person",
    "ORG": "Organization",
    "GPE": "Country",
    "LOC": "Country",
    "NORP": "Organization",
    "PRODUCT": "Product",
    "EVENT": "Event",
    "WORK_OF_ART": "Product",
    "FAC": "Organization",
}

# Lightweight cue-based relation detection. Order matters: most specific first.
RELATION_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("ACQUIRED", re.compile(r"\b(acquired|acquires|acquisition of|bought)\b", re.I)),
    ("INVESTED_IN", re.compile(r"\b(invested in|invests in|investment in|backed|funding for)\b", re.I)),
    ("PARTNERED", re.compile(r"\b(partner(?:ed|s)? with|partnership with|teamed up with|joint venture)\b", re.I)),
    ("ANNOUNCED", re.compile(r"\b(announced|unveiled|launched|introduces)\b", re.I)),
    ("REGULATED", re.compile(r"\b(regulator(?:y|s)?|fined|sanctioned|regulated)\b", re.I)),
    ("ATTACKED", re.compile(r"\b(attacked|strike on|hacked|breached)\b", re.I)),
    ("SUED", re.compile(r"\b(sued|sues|lawsuit|filed suit against)\b", re.I)),
]

POSITIVE = {"surge", "growth", "win", "wins", "record", "gain", "rises", "rise", "agreement", "deal",
            "approve", "approval", "expand", "expansion", "boost", "succeed", "success"}
NEGATIVE = {"loss", "losses", "decline", "fell", "drop", "drops", "fall", "fail", "failure", "crisis",
            "lawsuit", "sued", "sanction", "fine", "attack", "breach", "outage", "scandal", "fraud"}


@dataclass(frozen=True)
class EntityMention:
    name: str
    name_norm: str
    type: str


@dataclass(frozen=True)
class Relation:
    source: str  # entity name_norm
    target: str
    relation_type: str
    confidence: float
    sentence: str


@dataclass
class NlpResult:
    entities: list[tuple[EntityMention, int]]  # (entity, occurrences)
    relationships: list[Relation]
    sentiment: float


@lru_cache(maxsize=1)
def _nlp():
    import spacy
    try:
        return spacy.load(settings.spacy_model, disable=["lemmatizer"])
    except OSError as e:  # model not downloaded
        raise RuntimeError(
            f"spaCy model '{settings.spacy_model}' is not installed. "
            f"Run: python -m spacy download {settings.spacy_model}"
        ) from e


def normalize(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


def _classify_relation(sentence: str) -> tuple[str, float]:
    for name, pat in RELATION_PATTERNS:
        if pat.search(sentence):
            return name, 0.75
    return "MENTIONED_WITH", 0.45


def _sentiment(text: str) -> float:
    tokens = re.findall(r"[A-Za-z']+", text.lower())
    if not tokens:
        return 0.0
    pos = sum(1 for t in tokens if t in POSITIVE)
    neg = sum(1 for t in tokens if t in NEGATIVE)
    if pos + neg == 0:
        return 0.0
    return (pos - neg) / (pos + neg)


def analyze(text: str) -> NlpResult:
    if not text:
        return NlpResult(entities=[], relationships=[], sentiment=0.0)

    doc = _nlp()(text[:200_000])  # safety cap

    # ---- entities ----
    seen: dict[str, EntityMention] = {}
    counts: Counter[str] = Counter()
    for ent in doc.ents:
        if ent.label_ not in SPACY_TO_TYPE:
            continue
        name = ent.text.strip()
        if len(name) < 2 or name.isdigit():
            continue
        norm = normalize(name)
        if norm not in seen:
            seen[norm] = EntityMention(name=name, name_norm=norm, type=SPACY_TO_TYPE[ent.label_])
        counts[norm] += 1

    entities = [(seen[n], counts[n]) for n in seen]

    # ---- relationships (sentence-level co-occurrence with cue classification) ----
    relations: list[Relation] = []
    for sent in doc.sents:
        sent_text = sent.text
        sent_ents = [
            seen[normalize(e.text)]
            for e in sent.ents
            if e.label_ in SPACY_TO_TYPE and normalize(e.text) in seen
        ]
        if len(sent_ents) < 2:
            continue
        rel_type, conf = _classify_relation(sent_text)
        # All ordered pairs of distinct entities co-occurring in the same sentence.
        for i, a in enumerate(sent_ents):
            for b in sent_ents[i + 1 :]:
                if a.name_norm == b.name_norm:
                    continue
                # Keep direction stable to allow dedup downstream.
                src, tgt = sorted((a.name_norm, b.name_norm))
                relations.append(
                    Relation(source=src, target=tgt, relation_type=rel_type,
                             confidence=conf, sentence=sent_text.strip()[:500])
                )

    return NlpResult(entities=entities, relationships=relations, sentiment=_sentiment(text))


def warmup() -> None:
    """Load the spaCy model up-front (called from startup)."""
    _nlp()
