from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_roles
from ..db import get_db
from ..models import Article, ArticleEntity, Entity
from ..schemas import ArticleDetail, ArticleOut, EntityOut

router = APIRouter(prefix="/api/articles", tags=["articles"])


@router.get("", response_model=list[ArticleOut], dependencies=[Depends(require_roles())])
def list_articles(
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    source: str | None = None,
):
    stmt = select(Article).order_by(Article.created_at.desc()).offset(offset).limit(limit)
    if source:
        stmt = stmt.where(Article.source == source)
    return db.execute(stmt).scalars().all()


@router.get("/{article_id}", response_model=ArticleDetail, dependencies=[Depends(require_roles())])
def get_article(article_id: str, db: Session = Depends(get_db)):
    a = db.get(Article, article_id)
    if not a:
        raise HTTPException(status_code=404, detail="Article not found")
    ents = db.execute(
        select(Entity).join(ArticleEntity, ArticleEntity.entity_id == Entity.id)
        .where(ArticleEntity.article_id == article_id)
        .order_by(Entity.mentions.desc())
    ).scalars().all()
    detail = ArticleDetail.model_validate(a)
    detail.entities = [EntityOut.model_validate(e) for e in ents]
    return detail
