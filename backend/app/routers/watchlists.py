from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import current_user, require_roles
from ..db import get_db
from ..models import Alert, Entity, User, Watchlist
from ..schemas import AlertOut, WatchlistCreate, WatchlistOut

router = APIRouter(prefix="/api", tags=["watchlists"])


@router.get("/watchlists", response_model=list[WatchlistOut], dependencies=[Depends(require_roles("admin", "analyst"))])
def list_watchlists(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.execute(select(Watchlist).where(Watchlist.user_id == user.id)).scalars().all()
    ent_map = {
        e.id: e.name
        for e in db.execute(select(Entity).where(Entity.id.in_([r.entity_id for r in rows]))).scalars().all()
    }
    return [
        WatchlistOut(id=r.id, entity_id=r.entity_id, entity_name=ent_map.get(r.entity_id), created_at=r.created_at)
        for r in rows
    ]


@router.post("/watchlists", response_model=WatchlistOut, dependencies=[Depends(require_roles("admin", "analyst"))])
def add_watchlist(payload: WatchlistCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    ent = db.get(Entity, payload.entity_id)
    if not ent:
        raise HTTPException(status_code=404, detail="Entity not found")
    existing = db.execute(
        select(Watchlist).where(Watchlist.user_id == user.id, Watchlist.entity_id == ent.id)
    ).scalar_one_or_none()
    if existing:
        return WatchlistOut(id=existing.id, entity_id=ent.id, entity_name=ent.name, created_at=existing.created_at)
    w = Watchlist(user_id=user.id, entity_id=ent.id)
    db.add(w)
    db.commit()
    db.refresh(w)
    return WatchlistOut(id=w.id, entity_id=ent.id, entity_name=ent.name, created_at=w.created_at)


@router.delete("/watchlists/{watchlist_id}", dependencies=[Depends(require_roles("admin", "analyst"))])
def remove_watchlist(watchlist_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    w = db.get(Watchlist, watchlist_id)
    if not w or w.user_id != user.id:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    db.delete(w)
    db.commit()
    return {"ok": True}


@router.get("/alerts", response_model=list[AlertOut], dependencies=[Depends(require_roles("admin", "analyst"))])
def list_alerts(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.execute(
        select(Alert).where(Alert.user_id == user.id).order_by(Alert.created_at.desc()).limit(50)
    ).scalars().all()
    ent_map = {
        e.id: e.name
        for e in db.execute(select(Entity).where(Entity.id.in_([r.entity_id for r in rows]))).scalars().all()
    }
    from ..models import Article
    art_map = {
        a.id: a.title
        for a in db.execute(select(Article).where(Article.id.in_([r.article_id for r in rows]))).scalars().all()
    }
    return [
        AlertOut(
            id=r.id, entity_id=r.entity_id, entity_name=ent_map.get(r.entity_id),
            article_id=r.article_id, article_title=art_map.get(r.article_id),
            reason=r.reason, created_at=r.created_at, seen=r.seen,
        )
        for r in rows
    ]
