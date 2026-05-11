from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import require_roles
from ..db import get_db
from ..schemas import ArgumentRequest, ArgumentResponse
from ..services import argument_service

# Gated to admin + analyst — anonymous users cannot construct claims about named entities.
router = APIRouter(prefix="/api", tags=["argument"])


@router.post("/argument", response_model=ArgumentResponse, dependencies=[Depends(require_roles("admin", "analyst"))])
def build_argument(payload: ArgumentRequest, db: Session = Depends(get_db)):
    return argument_service.build_argument(
        db,
        subject_id=payload.subject_id,
        outcome_id=payload.outcome_id,
        theme_id=payload.theme_id,
        max_hops=payload.max_hops,
        min_confidence=max(0.4, min(0.9, payload.min_confidence)),
    )
