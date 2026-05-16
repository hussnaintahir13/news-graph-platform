from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_roles
from ..db import get_db
from ..models import Entity
from ..schemas import ArticleOut, EntityCreate, EntityDetail, EntityOut, RelationshipOut
from ..services import ai_service, entity_canonicalization, graph_service

router = APIRouter(prefix="/api/entities", tags=["entities"])


@router.post("", response_model=EntityOut, dependencies=[Depends(require_roles("admin", "analyst"))])
def create_entity(payload: EntityCreate, db: Session = Depends(get_db)):
    """Manually register an entity. Useful when NLP hasn't yet picked one up
    or when the user wants to track a concept (e.g. 'missiles').

    The submitted name is run through the canonicalization pipeline so that
    "Apple Inc." here matches "Apple" from the NLP extractor — there is one
    canonical Entity row per real-world thing regardless of how it was created.
    """
    canonical = entity_canonicalization.resolve(db, payload.name, payload.type)
    if not canonical.canonical_norm:
        raise HTTPException(status_code=400, detail="Name does not normalize to anything usable")

    # If canonicalization resolved to an existing entity via the alias table, return it.
    if canonical.entity_id is not None:
        existing = db.get(Entity, canonical.entity_id)
        if existing is not None:
            return existing

    # Otherwise dedupe by the canonical (name_norm, type) key.
    existing = db.execute(
        select(Entity).where(
            Entity.name_norm == canonical.canonical_norm, Entity.type == payload.type
        )
    ).scalar_one_or_none()
    if existing:
        # Record the submitted surface form as an alias for future lookups.
        if not canonical.is_canonical_surface:
            entity_canonicalization.record_alias(
                db, existing.id, payload.name, payload.type, source="manual"
            )
            db.commit()
        return existing

    ent = Entity(
        name=canonical.display_name or payload.name.strip(),
        name_norm=canonical.canonical_norm,
        type=payload.type,
        description=payload.description,
        mentions=0,
        wikidata_qid=canonical.wikidata_qid,
    )
    db.add(ent)
    db.flush()
    if not canonical.is_canonical_surface:
        entity_canonicalization.record_alias(
            db, ent.id, payload.name, payload.type, source="manual"
        )
    db.commit()
    db.refresh(ent)
    return ent


@router.get("", response_model=list[EntityOut], dependencies=[Depends(require_roles())])
def list_entities(
    db: Session = Depends(get_db),
    q: str | None = None,
    type: str | None = None,
    limit: int = Query(30, ge=1, le=200),
):
    stmt = select(Entity).order_by(Entity.mentions.desc()).limit(limit)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(Entity.name_norm.ilike(like))
    if type:
        stmt = stmt.where(Entity.type == type)
    return db.execute(stmt).scalars().all()


@router.get("/{entity_id}", response_model=EntityDetail, dependencies=[Depends(require_roles())])
def get_entity(entity_id: str, db: Session = Depends(get_db)):
    e = db.get(Entity, entity_id)
    if not e:
        raise HTTPException(status_code=404, detail="Entity not found")

    detail = EntityDetail.model_validate(e)
    if not e.description:
        try:
            generated = ai_service.summarise_entity(db, e)
            if generated:
                e.description = generated
                detail.description = generated
                db.commit()
        except Exception:
            db.rollback()  # description is best-effort; never 500 the page

    rels = graph_service.entity_relationships(db, entity_id)
    name_map = {x.id: x.name for x in db.execute(select(Entity).where(Entity.id.in_(
        {r.source_entity for r in rels} | {r.target_entity for r in rels}
    ))).scalars().all()}
    detail.relationships = [
        RelationshipOut(
            id=r.id,
            source_entity=r.source_entity,
            target_entity=r.target_entity,
            source_name=name_map.get(r.source_entity),
            target_name=name_map.get(r.target_entity),
            relation_type=r.relation_type,
            confidence=r.confidence,
            weight=r.weight,
            observed_at=r.observed_at,
        )
        for r in rels
    ]
    detail.timeline = graph_service.entity_timeline(db, entity_id)
    detail.articles = [ArticleOut.model_validate(a) for a in graph_service.entity_articles(db, entity_id, limit=20)]
    return detail
