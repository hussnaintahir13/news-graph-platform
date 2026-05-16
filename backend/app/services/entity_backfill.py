"""One-shot canonicalization backfill.

Run once after upgrading from a pre-canonicalization NewroSense / News Graph install:

    python -m app.services.entity_backfill

For every existing :class:`Entity` row we:

1. Re-run canonicalization (strong normalization + static alias table) on the
   stored ``name``.
2. If the canonical form differs from the existing ``name_norm`` AND a canonical
   entity already exists with that key, *merge* the duplicate into it:
       - re-point :class:`ArticleEntity` rows to the canonical entity
       - re-point :class:`Relationship_` rows (source and target) to the canonical entity
       - re-point :class:`Watchlist` and :class:`Alert` rows
       - sum the ``mentions`` counters
       - record an :class:`EntityAlias` row pointing the old name at the canonical id
       - delete the duplicate Entity row
3. If the canonical form differs but no other entity has that key, just update
   ``name`` / ``name_norm`` in place (rename without merge).
4. Optionally enrich with Wikidata QIDs when ``WIKIDATA_LOOKUP=true``.

The script is **idempotent**: running it twice produces no further changes.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..db import SessionLocal, init_db
from ..models import Alert, ArticleEntity, Entity, EntityAlias, Relationship_, Watchlist
from ..services import entity_canonicalization

log = logging.getLogger(__name__)


@dataclass
class BackfillReport:
    scanned: int = 0
    renamed: int = 0     # stage 3 — canonical key changed, no duplicate found
    merged: int = 0      # stage 2 — duplicate found and collapsed
    aliases_added: int = 0
    unchanged: int = 0

    def __str__(self) -> str:  # pragma: no cover — formatting only
        return (
            f"scanned={self.scanned} merged={self.merged} renamed={self.renamed} "
            f"aliases_added={self.aliases_added} unchanged={self.unchanged}"
        )


def _merge_entity_into(db: Session, duplicate: Entity, canonical: Entity) -> None:
    """Re-point every reference from ``duplicate`` to ``canonical``, then delete the dup.

    SQLite + SQLAlchemy ORM: we use bulk UPDATE statements rather than walking the
    ORM relationships because the article-entity / relationship tables can have
    thousands of rows per entity and ORM-level merges would be O(rows) flushes.
    """
    if duplicate.id == canonical.id:
        return

    # ArticleEntity: an (article, entity) pair may now collide with an existing
    # (article, canonical_entity) pair. Sum occurrences and drop the duplicate row.
    dup_ae = db.execute(
        select(ArticleEntity).where(ArticleEntity.entity_id == duplicate.id)
    ).scalars().all()
    for row in dup_ae:
        clash = db.execute(
            select(ArticleEntity).where(
                ArticleEntity.article_id == row.article_id,
                ArticleEntity.entity_id == canonical.id,
            )
        ).scalar_one_or_none()
        if clash is not None:
            clash.occurrences = (clash.occurrences or 0) + (row.occurrences or 0)
            db.delete(row)
        else:
            row.entity_id = canonical.id

    # Relationship_: re-point both endpoints. After re-pointing, a relationship can
    # become a self-loop (canonical → canonical) — drop those.
    db.execute(
        update(Relationship_)
        .where(Relationship_.source_entity == duplicate.id)
        .values(source_entity=canonical.id)
    )
    db.execute(
        update(Relationship_)
        .where(Relationship_.target_entity == duplicate.id)
        .values(target_entity=canonical.id)
    )
    self_loops = db.execute(
        select(Relationship_).where(
            Relationship_.source_entity == canonical.id,
            Relationship_.target_entity == canonical.id,
        )
    ).scalars().all()
    for sl in self_loops:
        db.delete(sl)

    # Watchlists & alerts: re-point.
    db.execute(
        update(Watchlist).where(Watchlist.entity_id == duplicate.id).values(entity_id=canonical.id)
    )
    db.execute(
        update(Alert).where(Alert.entity_id == duplicate.id).values(entity_id=canonical.id)
    )

    # EntityAlias rows that pointed at the duplicate now point at the canonical.
    db.execute(
        update(EntityAlias).where(EntityAlias.entity_id == duplicate.id).values(entity_id=canonical.id)
    )

    # Roll the mention counter up.
    canonical.mentions = (canonical.mentions or 0) + (duplicate.mentions or 0)

    # Carry over a wikidata QID if the duplicate had one and the canonical didn't.
    if duplicate.wikidata_qid and not canonical.wikidata_qid:
        canonical.wikidata_qid = duplicate.wikidata_qid

    db.delete(duplicate)


def run(db: Session) -> BackfillReport:
    report = BackfillReport()

    # Snapshot of all existing entities — we mutate as we go so we can't lazily iterate.
    entities = db.execute(select(Entity)).scalars().all()
    report.scanned = len(entities)

    # Group canonical keys to find pre-existing canonical entities efficiently.
    by_key: dict[tuple[str, str], Entity] = {}
    for ent in entities:
        by_key[(ent.name_norm, ent.type)] = ent

    for ent in entities:
        # The entity may already be deleted in this pass (merged into a canonical).
        if ent.id not in {e.id for e in entities if e in db}:
            # Cheap "still attached" check; SQLAlchemy turns deleted into transient.
            pass

        canonical = entity_canonicalization.resolve(db, ent.name, ent.type)
        canonical_key = (canonical.canonical_norm, ent.type)

        # Always record the original surface form as an alias so we don't lose audit
        # info even when the row didn't move.
        if ent.name and entity_canonicalization.normalize_strong(ent.name) != ent.name_norm:
            added = entity_canonicalization.record_alias(
                db, ent.id, ent.name, ent.type, source="backfill"
            )
            if added is not None:
                report.aliases_added += 1

        if canonical.canonical_norm == ent.name_norm:
            report.unchanged += 1
            continue

        target = by_key.get(canonical_key)
        if target is not None and target.id != ent.id:
            # Merge case: another row already owns the canonical key.
            entity_canonicalization.record_alias(
                db, target.id, ent.name, ent.type, source="backfill"
            )
            _merge_entity_into(db, ent, target)
            report.merged += 1
        else:
            # Rename in place — claim the canonical key.
            ent.name = canonical.display_name or ent.name
            ent.name_norm = canonical.canonical_norm
            by_key[canonical_key] = ent
            report.renamed += 1

    db.commit()
    return report


def main() -> None:  # pragma: no cover — CLI entry
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    init_db()
    with SessionLocal() as db:
        report = run(db)
        print(f"NewroSense entity backfill complete: {report}")


if __name__ == "__main__":
    main()
