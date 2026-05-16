"""Seed default users, sample sources, and trigger an immediate ingest pass.

Usage:
    python -m app.seeds
"""
from __future__ import annotations

import logging

from sqlalchemy import select

from .auth import hash_password
from .db import SessionLocal, init_db
from .models import Source, User
from .services import ingest_service, processing_service

log = logging.getLogger(__name__)

DEFAULT_USERS = [
    ("admin@example.com", "admin1234", "admin"),
    ("analyst@example.com", "analyst1234", "analyst"),
    ("user@example.com", "user1234", "user"),
]

DEFAULT_SOURCES = [
    # General world news
    ("BBC World", "rss", "https://feeds.bbci.co.uk/news/world/rss.xml"),
    ("Reuters World", "rss", "http://feeds.reuters.com/Reuters/worldNews"),
    ("The Guardian World", "rss", "https://www.theguardian.com/world/rss"),
    # Tech / business
    ("TechCrunch", "rss", "https://techcrunch.com/feed/"),
    ("The Verge", "rss", "https://www.theverge.com/rss/index.xml"),
    ("Hacker News Frontpage", "rss", "https://hnrss.org/frontpage"),
    # Pakistan / regional (since this user's context)
    ("Dawn — Top", "rss", "https://www.dawn.com/feeds/home"),
]


def seed() -> None:
    init_db()
    with SessionLocal() as db:
        for email, password, role in DEFAULT_USERS:
            if db.execute(select(User).where(User.email == email)).scalar_one_or_none():
                continue
            db.add(User(email=email, password_hash=hash_password(password), role=role))
        for name, kind, url in DEFAULT_SOURCES:
            if db.execute(select(Source).where(Source.url == url)).scalar_one_or_none():
                continue
            db.add(Source(name=name, kind=kind, url=url))
        db.commit()
        log.info("seeded default users and sources")

        print("NewroSense — running an initial ingest pass (this can take a few minutes)…")
        n_ingested = ingest_service.ingest_all(db)
        print(f"Ingested {n_ingested} new articles.")
        print("Running NLP processing…")
        n_processed = processing_service.process_unprocessed(db, limit=200)
        print(f"Processed {n_processed} articles.")
        print("Done. Open http://localhost:5000")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed()
