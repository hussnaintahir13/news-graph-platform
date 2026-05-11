from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import require_roles
from ..db import get_db
from ..models import Entity
from ..schemas import GraphResponse
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
