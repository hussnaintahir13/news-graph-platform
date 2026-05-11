from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_roles
from ..db import get_db
from ..models import Entity
from ..schemas import AskRequest, AskResponse, HypothesisRequest, HypothesisResponse
from ..services import ai_service

router = APIRouter(prefix="/api", tags=["ai"])


@router.post("/ask", response_model=AskResponse, dependencies=[Depends(require_roles())])
def ask(payload: AskRequest, db: Session = Depends(get_db)):
    return ai_service.answer_question(db, payload.question)


@router.get("/explain/{source_id}/{target_id}", dependencies=[Depends(require_roles())])
def explain(source_id: str, target_id: str, db: Session = Depends(get_db)):
    return {"explanation": ai_service.explain_relationship(db, source_id, target_id)}


@router.post("/hypothesis", response_model=HypothesisResponse, dependencies=[Depends(require_roles())])
def hypothesis(payload: HypothesisRequest, db: Session = Depends(get_db)):
    if len(payload.entity_ids) < 2:
        raise HTTPException(status_code=400, detail="Provide at least two entity_ids")
    # Validate entities exist; silently drop unknown ones.
    found = {e.id for e in db.execute(select(Entity).where(Entity.id.in_(payload.entity_ids))).scalars().all()}
    valid = [i for i in payload.entity_ids if i in found]
    if len(valid) < 2:
        raise HTTPException(status_code=404, detail="At least two valid entity_ids are required")
    return ai_service.build_hypothesis(
        db, valid,
        max_hops=max(1, min(4, payload.max_hops)),
        max_paths_per_pair=max(1, min(10, payload.max_paths_per_pair)),
    )
