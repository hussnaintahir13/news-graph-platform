import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import current_user, require_roles
from ..db import get_db
from ..models import Interest, User
from ..schemas import InterestCreate, InterestOut

router = APIRouter(prefix="/api/interests", tags=["interests"])


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


@router.get("", response_model=list[InterestOut], dependencies=[Depends(require_roles())])
def list_interests(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return db.execute(
        select(Interest).where(Interest.user_id == user.id)
        .order_by(Interest.priority.desc(), Interest.created_at.desc())
    ).scalars().all()


@router.post("", response_model=InterestOut, dependencies=[Depends(require_roles())])
def add_interest(payload: InterestCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    keyword = payload.keyword.strip()
    norm = _normalize(keyword)
    if not norm:
        raise HTTPException(400, "Keyword cannot be empty")
    existing = db.execute(
        select(Interest).where(Interest.user_id == user.id, Interest.keyword_norm == norm)
    ).scalar_one_or_none()
    if existing:
        existing.priority = max(existing.priority, payload.priority)
        db.commit()
        db.refresh(existing)
        return existing
    interest = Interest(user_id=user.id, keyword=keyword, keyword_norm=norm, priority=payload.priority)
    db.add(interest)
    db.commit()
    db.refresh(interest)
    return interest


@router.delete("/{interest_id}", dependencies=[Depends(require_roles())])
def remove_interest(interest_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    interest = db.get(Interest, interest_id)
    if not interest or interest.user_id != user.id:
        raise HTTPException(404, "Not found")
    db.delete(interest)
    db.commit()
    return {"ok": True}
