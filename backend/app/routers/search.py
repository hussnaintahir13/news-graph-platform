from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import require_roles
from ..db import get_db
from ..schemas import SearchHit, SearchRequest
from ..services import search_service

router = APIRouter(prefix="/api/search", tags=["search"])


@router.post("", response_model=list[SearchHit], dependencies=[Depends(require_roles())])
def search(payload: SearchRequest, db: Session = Depends(get_db)):
    return search_service.search(db, payload.q, payload.mode, payload.limit)
