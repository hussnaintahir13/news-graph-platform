from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import require_roles
from ..db import get_db
from ..schemas import AskRequest, AskResponse
from ..services import ai_service

router = APIRouter(prefix="/api", tags=["ai"])


@router.post("/ask", response_model=AskResponse, dependencies=[Depends(require_roles())])
def ask(payload: AskRequest, db: Session = Depends(get_db)):
    return ai_service.answer_question(db, payload.question)


@router.get("/explain/{source_id}/{target_id}", dependencies=[Depends(require_roles())])
def explain(source_id: str, target_id: str, db: Session = Depends(get_db)):
    return {"explanation": ai_service.explain_relationship(db, source_id, target_id)}
