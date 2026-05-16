import logging

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

log = logging.getLogger(__name__)

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Lightweight idempotent migrations
# ---------------------------------------------------------------------------
# create_all() creates missing TABLES but does not ALTER existing ones. NewroSense
# v0.2 adds a single new column (`entities.wikidata_qid`) to a table that v0.1 users
# already have. We patch it in here so installations upgrade transparently without
# pulling in Alembic for one column. The shim is intentionally narrow — it only
# adds columns it knows are missing, and only against SQLite. Postgres users are
# expected to run real migrations via Alembic.
_SCHEMA_ADDITIONS: list[tuple[str, str, str]] = [
    # (table_name, column_name, "ADD COLUMN ..." DDL fragment)
    ("entities", "wikidata_qid", "ADD COLUMN wikidata_qid VARCHAR(32)"),
]


def _apply_inline_migrations() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())
    for table, column, ddl in _SCHEMA_ADDITIONS:
        if table not in existing_tables:
            # Table is brand new — create_all() will handle the full schema.
            continue
        cols = {c["name"] for c in insp.get_columns(table)}
        if column in cols:
            continue
        log.info("applying inline migration: ALTER TABLE %s %s", table, ddl)
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE {table} {ddl}"))


def init_db() -> None:
    from . import models  # noqa: F401 — ensure models are registered
    Base.metadata.create_all(bind=engine)
    _apply_inline_migrations()
