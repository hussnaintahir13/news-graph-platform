from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_roles
from ..db import SessionLocal, get_db
from ..models import Source
from ..schemas import SourceCreate, SourceOut
from ..services import ingest_service, processing_service

router = APIRouter(prefix="/api/ingest", tags=["ingest"])


def _run_pipeline_now() -> None:
    """Run ingestion then processing on a fresh session — used by background tasks."""
    with SessionLocal() as db:
        ingest_service.ingest_all(db)
        processing_service.process_unprocessed(db)


@router.get("/sources", response_model=list[SourceOut], dependencies=[Depends(require_roles("admin", "analyst"))])
def list_sources(db: Session = Depends(get_db)):
    return db.execute(select(Source).order_by(Source.created_at.desc())).scalars().all()


@router.post("/sources", response_model=SourceOut, dependencies=[Depends(require_roles("admin"))])
def create_source(payload: SourceCreate, db: Session = Depends(get_db)):
    if db.execute(select(Source).where(Source.url == payload.url)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Source URL already exists")
    s = Source(name=payload.name, kind=payload.kind, url=payload.url, enabled=payload.enabled)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/sources/{source_id}", dependencies=[Depends(require_roles("admin"))])
def delete_source(source_id: str, db: Session = Depends(get_db)):
    s = db.get(Source, source_id)
    if not s:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(s)
    db.commit()
    return {"ok": True}


@router.post("/run", dependencies=[Depends(require_roles("admin"))])
def run_now(background: BackgroundTasks):
    background.add_task(_run_pipeline_now)
    return {"queued": True}
