"""Interest-driven priority crawling via Google News RSS.

For each unique keyword across the Interest table, the scheduler builds a
Google News RSS URL and ingests its top headlines. Articles flow into the
same pipeline (dedup, NLP, embeddings, graph upsert).
"""
from __future__ import annotations

import logging
from datetime import datetime
from urllib.parse import quote
from urllib.parse import urlparse

import feedparser
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Article, Interest
from ..services.ingest_service import _extract_article, _fetch, MAX_PER_SOURCE

log = logging.getLogger(__name__)

GOOGLE_NEWS_RSS = "https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"


def _gn_url(keyword: str) -> str:
    return GOOGLE_NEWS_RSS.format(q=quote(keyword))


def unique_interest_keywords(db: Session) -> list[str]:
    """Distinct keywords across all users, ordered by total priority (highest first)."""
    rows = db.execute(select(Interest)).scalars().all()
    by_kw: dict[str, int] = {}
    for r in rows:
        by_kw[r.keyword] = by_kw.get(r.keyword, 0) + r.priority
    return [k for k, _ in sorted(by_kw.items(), key=lambda kv: kv[1], reverse=True)]


def ingest_interests(db: Session, max_per_keyword: int = 10) -> int:
    """For each interest keyword, fetch its Google News RSS feed and store any new articles."""
    keywords = unique_interest_keywords(db)
    if not keywords:
        return 0
    saved = 0
    for keyword in keywords:
        try:
            parsed = feedparser.parse(_gn_url(keyword))
        except Exception as e:
            log.warning("interest feed parse failed for %s: %s", keyword, e)
            continue
        for entry in parsed.entries[:max_per_keyword]:
            link = entry.get("link")
            if not link:
                continue
            if db.execute(select(Article).where(Article.url == link)).scalar_one_or_none():
                continue
            html = _fetch(link)
            if not html:
                continue
            data = _extract_article(html, link)
            if not data:
                continue
            published = None
            if entry.get("published_parsed"):
                published = datetime(*entry["published_parsed"][:6])
            article = Article(
                title=entry.get("title") or data["title"],
                content=data["content"],
                author=data.get("author"),
                url=link,
                image_url=data.get("image_url"),
                source=urlparse(link).netloc + f" (interest: {keyword})",
                published_at=published or data.get("published_at"),
            )
            db.add(article)
            saved += 1
        db.commit()
    log.info("ingest_interests saved %d articles from %d keywords", saved, len(keywords))
    return saved
