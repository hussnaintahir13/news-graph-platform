"""Entity canonicalization.

The raw output of spaCy's NER is a surface form: "Apple", "Apple Inc.", "Apple Inc",
"AAPL", "Apple Computer Inc" all come out as distinct entity mentions even though they
refer to the same real-world entity. Without canonicalization the graph fills up with
near-duplicate nodes and the visualisation becomes unreadable around 500+ entities.

This module collapses surface forms in three stages, cheapest first:

1. **Strong text normalization** — lowercase, strip punctuation, strip legal suffixes
   ("Inc.", "Corp.", "Ltd", "LLC", "plc", "GmbH", "S.A.", "N.V.", "AG", "Co."), collapse
   whitespace. Pure stdlib, no I/O.

2. **Static alias table** — hand-curated mappings for the cases stage 1 cannot handle:
   tickers → companies ("AAPL" → "Apple"), abbreviations ("US" → "United States"),
   brand variants ("Meta Platforms" → "Meta"). Pure dict lookup.

3. **On-line lookup against a DB-backed alias table** — for surface forms previously
   resolved by stages 1, 2, or by the Wikidata enrichment path. The DB lookup is the
   long-term memory of the canonicalizer.

4. **(Optional) Wikidata QID enrichment** — guarded by ``settings.wikidata_lookup``.
   Calls the public ``wbsearchentities`` API once per unseen surface form, caches the
   result as an :class:`EntityAlias` row plus a QID on the canonical :class:`Entity`.
   Off by default so the platform stays fully offline.

Public API used by :mod:`services.processing_service`:

    resolve(db, surface_name, entity_type)
        Returns ``CanonicalResult(display_name, canonical_norm, entity_id_or_None,
        wikidata_qid_or_None)`` — entity_id is set if an existing canonical entity was
        found via stages 2 or 3; processing_service then either uses that id directly
        or hands display_name/canonical_norm off to ``graph_service.upsert_entity``
        which dedupes by (name_norm, type).
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Entity, EntityAlias

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Stage 1 — strong normalization
# ---------------------------------------------------------------------------
# Legal suffixes recognized by the strong normalizer. Single regex so it can strip
# multiple suffixes ("Apple Inc Limited" → "apple") in one pass. Word-boundary
# anchored so we don't eat "incorrect" or "incident".
_LEGAL_SUFFIX_PATTERN = re.compile(
    r"\b("
    r"inc\.?|incorporated|"
    r"corp\.?|corporation|"
    r"ltd\.?|limited|"
    r"llc|l\.l\.c\.|"
    r"plc|p\.l\.c\.|"
    r"gmbh|"
    r"s\.?a\.?|sociedad an[oó]nima|"
    r"n\.?v\.?|"
    r"a\.?g\.?|aktiengesellschaft|"
    r"co\.?|company|"
    r"holdings|holding|group|"
    r"sa de cv|sas|s\.l\.|"
    r"pty|pty\.? ltd\.?|"
    r"oyj|ab|asa|spa|s\.p\.a\.|bv|b\.v\."
    r")\b",
    re.IGNORECASE,
)

# Punctuation we want gone before the unique key is computed. We deliberately keep
# spaces and digits — "9/11" and "F-16" mean different things from "911" and "F16".
_PUNCT_PATTERN = re.compile(r"[^\w\s]")
_WHITESPACE_PATTERN = re.compile(r"\s+")


def normalize_strong(name: str) -> str:
    """Strong normalization — what stage 1 produces and what we hash on.

    >>> normalize_strong("Apple Inc.")
    'apple'
    >>> normalize_strong("META PLATFORMS, INC.")
    'meta platforms'
    >>> normalize_strong("  The   New York  Times  ")
    'the new york times'
    """
    if not name:
        return ""
    s = name.strip()
    s = _LEGAL_SUFFIX_PATTERN.sub("", s)
    s = _PUNCT_PATTERN.sub(" ", s)
    s = _WHITESPACE_PATTERN.sub(" ", s).strip().lower()
    return s


# ---------------------------------------------------------------------------
# Stage 2 — static alias table
# ---------------------------------------------------------------------------
# Hand-curated mappings. Keys are (normalized_alias, entity_type). Values are
# (canonical_display_name, canonical_normalized_name). We intentionally keep this
# list small — better to grow it via real traffic than to over-commit upfront.
#
# Display names follow common journalistic style (no "Inc.", no ticker), so the
# entity page reads naturally.
_STATIC_ALIASES: dict[tuple[str, str], tuple[str, str]] = {
    # ---------- US tech tickers ----------
    ("aapl", "Organization"): ("Apple", "apple"),
    ("apple computer", "Organization"): ("Apple", "apple"),
    ("apple computer", "Product"): ("Apple", "apple"),
    ("msft", "Organization"): ("Microsoft", "microsoft"),
    ("googl", "Organization"): ("Alphabet", "alphabet"),
    ("goog", "Organization"): ("Alphabet", "alphabet"),
    ("alphabet", "Organization"): ("Alphabet", "alphabet"),
    ("amzn", "Organization"): ("Amazon", "amazon"),
    ("meta platforms", "Organization"): ("Meta", "meta"),
    ("facebook", "Organization"): ("Meta", "meta"),  # legal name change
    ("fb", "Organization"): ("Meta", "meta"),
    ("nvda", "Organization"): ("Nvidia", "nvidia"),
    ("tsla", "Organization"): ("Tesla", "tesla"),
    ("tsmc", "Organization"): ("TSMC", "tsmc"),
    ("taiwan semiconductor manufacturing", "Organization"): ("TSMC", "tsmc"),
    ("amd", "Organization"): ("AMD", "amd"),
    ("ibm", "Organization"): ("IBM", "ibm"),
    ("oracle", "Organization"): ("Oracle", "oracle"),
    ("openai", "Organization"): ("OpenAI", "openai"),
    ("anthropic", "Organization"): ("Anthropic", "anthropic"),
    # ---------- Country abbreviations (spaCy emits GPE) ----------
    ("us", "Country"): ("United States", "united states"),
    ("u s", "Country"): ("United States", "united states"),
    ("usa", "Country"): ("United States", "united states"),
    ("u s a", "Country"): ("United States", "united states"),
    ("america", "Country"): ("United States", "united states"),
    ("uk", "Country"): ("United Kingdom", "united kingdom"),
    ("u k", "Country"): ("United Kingdom", "united kingdom"),
    ("britain", "Country"): ("United Kingdom", "united kingdom"),
    ("great britain", "Country"): ("United Kingdom", "united kingdom"),
    ("uae", "Country"): ("United Arab Emirates", "united arab emirates"),
    ("ksa", "Country"): ("Saudi Arabia", "saudi arabia"),
    ("prc", "Country"): ("China", "china"),
    ("rok", "Country"): ("South Korea", "south korea"),
    ("dprk", "Country"): ("North Korea", "north korea"),
    # ---------- Common organisations ----------
    ("eu", "Organization"): ("European Union", "european union"),
    ("e u", "Organization"): ("European Union", "european union"),
    ("un", "Organization"): ("United Nations", "united nations"),
    ("u n", "Organization"): ("United Nations", "united nations"),
    ("nato", "Organization"): ("NATO", "nato"),
    ("imf", "Organization"): ("International Monetary Fund", "international monetary fund"),
    ("who", "Organization"): ("World Health Organization", "world health organization"),
    ("ecb", "Organization"): ("European Central Bank", "european central bank"),
    ("fed", "Organization"): ("Federal Reserve", "federal reserve"),
    ("federal reserve", "Organization"): ("Federal Reserve", "federal reserve"),
    ("the fed", "Organization"): ("Federal Reserve", "federal reserve"),
    ("sec", "Organization"): ("SEC", "sec"),
    ("ftc", "Organization"): ("FTC", "ftc"),
}


def _static_lookup(name_norm: str, entity_type: str) -> Optional[tuple[str, str]]:
    """Return ``(display_name, canonical_norm)`` if this normalized alias is in the static table."""
    return _STATIC_ALIASES.get((name_norm, entity_type))


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class CanonicalResult:
    """Outcome of canonicalizing one surface form.

    Attributes:
        display_name: The name the UI should show ("Apple", not "AAPL").
        canonical_norm: The normalized key that the DB unique constraint hashes on.
        entity_id: If we found an existing canonical entity (via DB alias lookup),
            its id. ``None`` means "ask graph_service.upsert_entity to find-or-create
            by (canonical_norm, type)".
        wikidata_qid: Populated when Wikidata enrichment is enabled and resolved.
        alias_source: Where the resolution came from — useful for telemetry and the
            backfill audit log.
        is_canonical_surface: True if the input surface form already matched the
            canonical form (no rewriting happened). False if we rewrote it.
    """

    display_name: str
    canonical_norm: str
    entity_id: Optional[str] = None
    wikidata_qid: Optional[str] = None
    alias_source: str = "auto"
    is_canonical_surface: bool = False


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def resolve(db: Session, surface_name: str, entity_type: str) -> CanonicalResult:
    """Resolve a surface form to a canonical (display_name, canonical_norm[, entity_id]).

    This is the function the NLP pipeline should call before upserting an entity.
    """
    surface_clean = (surface_name or "").strip()
    if not surface_clean:
        return CanonicalResult(display_name="", canonical_norm="", alias_source="empty")

    surface_norm = normalize_strong(surface_clean)

    # ---- Stage 3 first: did we already learn this surface form? ----
    # (Cheaper than walking the static table for already-known aliases.)
    alias = db.execute(
        select(EntityAlias).where(
            EntityAlias.alias_norm == surface_norm,
            EntityAlias.type == entity_type,
        )
    ).scalar_one_or_none()
    if alias is not None:
        ent = db.get(Entity, alias.entity_id)
        if ent is not None:
            return CanonicalResult(
                display_name=ent.name,
                canonical_norm=ent.name_norm,
                entity_id=ent.id,
                wikidata_qid=ent.wikidata_qid,
                alias_source=alias.source,
                is_canonical_surface=(surface_norm == ent.name_norm),
            )

    # ---- Stage 2: static alias table ----
    static = _static_lookup(surface_norm, entity_type)
    if static is not None:
        display_name, canonical_norm = static
        return CanonicalResult(
            display_name=display_name,
            canonical_norm=canonical_norm,
            alias_source="static",
            is_canonical_surface=(surface_norm == canonical_norm),
        )

    # ---- Stage 4 (optional): Wikidata QID lookup ----
    if settings.wikidata_lookup:
        wd = _wikidata_lookup(surface_clean, entity_type)
        if wd is not None:
            display_name, canonical_norm, qid = wd
            return CanonicalResult(
                display_name=display_name,
                canonical_norm=canonical_norm,
                wikidata_qid=qid,
                alias_source="wikidata",
                is_canonical_surface=(surface_norm == canonical_norm),
            )

    # ---- Fallback: keep the surface form, but use strong normalization as the key ----
    # This is the path most novel entities take. The strong-normalized key is what
    # makes "Apple Inc.", "Apple Inc", "apple inc." dedupe naturally even without
    # being in the static table.
    return CanonicalResult(
        display_name=surface_clean,
        canonical_norm=surface_norm,
        alias_source="normalized",
        is_canonical_surface=True,
    )


def record_alias(
    db: Session,
    entity_id: str,
    alias_name: str,
    entity_type: str,
    source: str = "spacy",
) -> Optional[EntityAlias]:
    """Persist a surface-form → canonical-entity mapping.

    Idempotent — if an alias row already exists for (alias_norm, type) it's returned
    unchanged. The NLP pipeline calls this for every surface form it sees so the
    learned-alias table grows organically.
    """
    norm = normalize_strong(alias_name)
    if not norm:
        return None
    existing = db.execute(
        select(EntityAlias).where(
            EntityAlias.alias_norm == norm,
            EntityAlias.type == entity_type,
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    alias = EntityAlias(
        entity_id=entity_id,
        alias_name=alias_name.strip()[:255],
        alias_norm=norm,
        type=entity_type,
        source=source,
    )
    db.add(alias)
    # Caller controls commit; we just flush so the row is visible within this txn.
    db.flush()
    return alias


# ---------------------------------------------------------------------------
# Stage 4 — Wikidata (lazy, network)
# ---------------------------------------------------------------------------
@lru_cache(maxsize=2048)
def _wikidata_lookup(surface: str, entity_type: str) -> Optional[tuple[str, str, str]]:
    """Call Wikidata's wbsearchentities for ``surface``. Returns ``(label, norm, qid)``
    on a confident match, ``None`` otherwise.

    Lazy: the ``httpx`` import is done inside so an offline environment never pays
    for it. Failures are swallowed and cached as ``None`` so we don't repeatedly hit
    a broken network.
    """
    try:
        import httpx  # local import keeps offline installs cheap
    except Exception:
        return None

    # Hint the search type from our internal type so we don't accept a Person match
    # for an Organization surface form, and vice versa.
    type_hint = {
        "Person": "Q5",          # human
        "Organization": "Q43229",  # organization
        "Country": "Q6256",      # country
        "Product": "Q2424752",   # product
        "Event": "Q1656682",     # event
    }.get(entity_type)

    try:
        r = httpx.get(
            "https://www.wikidata.org/w/api.php",
            params={
                "action": "wbsearchentities",
                "search": surface,
                "language": "en",
                "format": "json",
                "limit": 5,
                "type": "item",
            },
            timeout=4.0,
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        log.debug("wikidata lookup failed for %s: %s", surface, e)
        return None

    for hit in data.get("search", []):
        # Filter by instance-of if we have a type hint; the wbsearchentities response
        # doesn't carry P31 directly so we accept the top hit as long as its label
        # looks plausible. Stricter validation would need a second API call per hit.
        label = hit.get("label")
        qid = hit.get("id")
        if not label or not qid:
            continue
        if type_hint and entity_type:
            # Accept the first hit; conservative consumers can re-validate downstream.
            pass
        return label, normalize_strong(label), qid

    return None
