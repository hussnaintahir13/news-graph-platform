from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..auth import require_roles
from ..db import get_db
from ..models import Entity
from ..schemas import GraphResponse, MultiGraphRequest, PathInfo
from ..services import graph_service

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/{entity_id}", response_model=GraphResponse, dependencies=[Depends(require_roles())])
def get_subgraph(
    entity_id: str,
    db: Session = Depends(get_db),
    depth: int = Query(1, ge=1, le=3),
    limit: int = Query(80, ge=5, le=300),
):
    if not db.get(Entity, entity_id):
        raise HTTPException(status_code=404, detail="Entity not found")
    return graph_service.neighbourhood(db, entity_id, depth=depth, limit=limit)


@router.get("/top/centrality", dependencies=[Depends(require_roles())])
def centrality(db: Session = Depends(get_db), top: int = Query(25, ge=5, le=100)):
    return [
        {"entity_id": e.id, "name": e.name, "type": e.type, "degree": d}
        for e, d in graph_service.degree_centrality(db, top=top)
    ]


@router.post("/multi", response_model=GraphResponse, dependencies=[Depends(require_roles())])
def multi_subgraph(payload: MultiGraphRequest, db: Session = Depends(get_db)):
    if not payload.entity_ids:
        raise HTTPException(status_code=400, detail="entity_ids is required")
    found = db.execute(select(Entity).where(Entity.id.in_(payload.entity_ids))).scalars().all()
    if not found:
        raise HTTPException(status_code=404, detail="None of the entity IDs were found")
    valid_ids = [e.id for e in found]
    return graph_service.multi_neighbourhood(db, valid_ids, depth=max(1, min(3, payload.depth)), limit=min(300, payload.limit))


@router.get("/path/{src_id}/{dst_id}", response_model=list[PathInfo], dependencies=[Depends(require_roles())])
def path_between(
    src_id: str, dst_id: str,
    db: Session = Depends(get_db),
    max_hops: int = Query(3, ge=1, le=4),
    max_paths: int = Query(5, ge=1, le=10),
):
    if not db.get(Entity, src_id) or not db.get(Entity, dst_id):
        raise HTTPException(status_code=404, detail="Source or target entity not found")
    edges = graph_service.find_paths(db, src_id, dst_id, max_hops=max_hops, max_paths=max_paths)
    ids = set([src_id, dst_id])
    for p in edges:
        for e in p:
            ids.add(e.source_entity); ids.add(e.target_entity)
    ent_rows = db.execute(select(Entity).where(Entity.id.in_(ids))).scalars().all()
    emap = {e.id: e for e in ent_rows}
    return [graph_service.edges_to_path_info(p, src_id, dst_id, emap) for p in edges]
