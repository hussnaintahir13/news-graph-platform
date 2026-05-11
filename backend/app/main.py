from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .config import settings
from .db import init_db
from .jobs import scheduler
from .routers import ai, articles, auth_router, entities, graph, ingest, interests, search, watchlists

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("newsgraph")

limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit])


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    scheduler.start()
    log.info("newsgraph backend started")
    try:
        yield
    finally:
        scheduler.stop()


app = FastAPI(
    title="AI News Relationship Map",
    version="0.1.0",
    description="MVP backend: ingest news, extract entities/relationships, expose a graph API.",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


# Routers
app.include_router(auth_router.router)
app.include_router(articles.router)
app.include_router(entities.router)
app.include_router(graph.router)
app.include_router(search.router)
app.include_router(ai.router)
app.include_router(ingest.router)
app.include_router(watchlists.router)
app.include_router(interests.router)


@app.exception_handler(Exception)
async def _global_exception(_: Request, exc: Exception):
    log.exception("unhandled: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
