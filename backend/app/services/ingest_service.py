"""News ingestion: RSS, sitemap, and ad-hoc URL fetching with boilerplate removal."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Iterable
from urllib.parse import urlparse

import feedparser
import httpx
import trafilatura
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Article, Source

log = logging.getLogger(__name__)

DEFAULT_HEADERS = {
    "User-Agent": "NewsGraphBot/1.0 (+https://github.com/hussnaintahir13)"
}
FETCH_TIMEOUT = 20.0
MAX_PER_SOURCE = 25
MAX_RETRIES = 3


def _fetch(url: str) -> str | None:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with httpx.Client(headers=DEFAULT_HEADERS, follow_redirects=True, timeout=FETCH_TIMEOUT) as c:
                r = c.get(url)
                r.raise_for_status()
                return r.text
        except Exception as e:
            log.warning("fetch failed %s attempt %s: %s", url, attempt, e)
    return None


def _fetch_playwright(url: str) -> str | None:  # Stub — implement when JS-rendered sites are needed.
    return None


def _extract_article(html: str, url: str) -> dict | None:
    if not html:
        return None
    extracted = trafilatura.extract(
        html, include_comments=False, include_tables=False, with_metadata=True,
        output_format="json", url=url,
    )
    if extracted:
        import json
        try:
            data = json.loads(extracted)
        except json.JSONDecodeError:
            data = None
        if data and data.get("text"):
            return {
                "title": data.get("title") or _title_fallback(html),
                "author": data.get("author"),
                "content": data["text"],
                "image_url": data.get("image"),
                "published_at": _parse_dt(data.get("date")),
            }
    # Fallback to a manual BeautifulSoup parse.
    soup = BeautifulSoup(html, "html.parser")
    title = _title_fallback(html, soup)
    text = " ".join(p.get_text(" ", strip=True) for p in soup.find_all("p"))
    if not text.strip():
        return None
    return {"title": title, "author": None, "content": text, "image_url": None, "published_at": None}


def _title_fallback(html: str, soup: BeautifulSoup | None = None) -> str:
    soup = soup or BeautifulSoup(html, "html.parser")
    if soup.title and soup.title.string:
        return soup.title.string.strip()[:1024]
    h1 = soup.find("h1")
    if h1:
        return h1.get_text(" ", strip=True)[:1024]
    return "(untitled)"


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(value[:25], fmt).replace(tzinfo=None)
        except (ValueError, TypeError):
            continue
    return None


# ---------- RSS ----------
def _rss_links(url: str) -> Iterable[tuple[str, dict]]:
    parsed = feedparser.parse(url)
    for e in parsed.entries[:MAX_PER_SOURCE]:
        link = e.get("link")
        if not link:
            continue
        meta: dict = {}
        if e.get("published_parsed"):
            meta["published_at"] = datetime(*e["published_parsed"][:6])
        if e.get("title"):
            meta["title"] = e.get("title")
        yield link, meta


# ---------- Sitemap ----------
def _sitemap_links(url: str) -> Iterable[tuple[str, dict]]:
    html = _fetch(url)
    if not html:
        return []
    soup = BeautifulSoup(html, "xml")
    locs = [loc.get_text(strip=True) for loc in soup.find_all("loc")][:MAX_PER_SOURCE]
    for link in locs:
        yield link, {}


# ---------- Main entry ----------
def ingest_source(db: Session, source: Source) -> list[Article]:
    if source.kind == "rss":
        link_iter = _rss_links(source.url)
    elif source.kind == "sitemap":
        link_iter = _sitemap_links(source.url)
    elif source.kind == "url":
        link_iter = [(source.url, {})]
    else:
        return []

    saved: list[Article] = []
    for link, meta in link_iter:
        if db.execute(select(Article).where(Article.url == link)).scalar_one_or_none():
            continue
        html = _fetch(link)
        if not html:
            continue
        data = _extract_article(html, link)
        if not data:
            continue
        article = Article(
            title=meta.get("title") or data["title"],
            content=data["content"],
            author=data.get("author"),
            url=link,
            image_url=data.get("image_url"),
            source=urlparse(link).netloc,
            published_at=meta.get("published_at") or data.get("published_at"),
        )
        db.add(article)
        saved.append(article)

    source.last_run_at = datetime.utcnow()
    db.commit()
    return saved


def ingest_all(db: Session) -> int:
    sources = db.execute(select(Source).where(Source.enabled.is_(True))).scalars().all()
    total = 0
    for s in sources:
        try:
            saved = ingest_source(db, s)
            total += len(saved)
        except Exception as e:
            log.exception("ingest failed for %s: %s", s.url, e)
    return total
