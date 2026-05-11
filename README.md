# AI News Relationship Map

An MVP implementation of the AI News Relationship Map platform: ingest news, extract entities and relationships, store them in a graph-shaped store, and visualise them interactively.

## What's implemented (MVP)

| Spec section | Status | Notes |
| --- | --- | --- |
| 2.1 News ingestion | ✅ RSS + sitemap + ad-hoc URL | feedparser + httpx |
| 2.2 Article processing | ✅ | trafilatura for boilerplate removal |
| 2.3 NLP extraction | ✅ | spaCy NER + co-occurrence + sentence-transformers embeddings |
| 2.4 Relationship engine | ✅ | confidence + dedup + edge weighting + temporal |
| 2.5 Graph visualisation | ✅ | React Flow — pan/zoom/expand/filter |
| 2.6 Search | ✅ | keyword (SQLite FTS) + semantic (cosine over embeddings) + entity |
| 2.7 AI features | ✅ | OpenAI when `OPENAI_API_KEY` set; deterministic fallback otherwise |
| 2.8 Live monitoring | ✅ (basic) | watchlists + recent-mentions alert; trend detection stubbed |
| 3 Non-functional | ✅ baseline | JWT, RBAC roles, rate-limit middleware, retries on jobs |

## What's deferred (with extension hooks)

| Spec section | Why deferred | Extension hook |
| --- | --- | --- |
| Neo4j | Adds infra cost in MVP; SQL graph queries are sufficient under 10M edges | `backend/app/services/graph_service.py` is the single seam — implement `Neo4jGraphService` and inject |
| Redis + BullMQ/Celery | APScheduler covers MVP throughput | `backend/app/jobs/scheduler.py` — swap to Celery by registering tasks in `app/jobs/celery_app.py` |
| Elasticsearch | SQLite FTS + cosine is enough for 100k-1M articles | `backend/app/services/search_service.py` exposes the same interface |
| Playwright JS-rendered crawl | `trafilatura` covers static HTML; add Playwright when sources need JS | `backend/app/services/ingest_service.py::_fetch_playwright` is stubbed |
| Multilingual NLP | English-only models loaded | Swap spaCy model code in `nlp_service.py` |

## Quick start

### Prerequisites

- Python 3.11+
- Node.js 20+
- (optional) Docker Desktop

### Option A — two terminals (recommended for development)

**Backend**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows; on macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
copy .env.example .env          # Windows; on macOS/Linux: cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5000.

### Option B — Docker

```bash
docker compose up --build
```

### Seed sample data

The first time the backend starts it auto-creates the SQLite database. To seed sample sources and run an immediate ingestion pass:

```bash
cd backend
.venv\Scripts\activate
python -m app.seeds
```

Then visit http://localhost:5000/graph.

## Default users

After seeding:

| Email | Password | Role |
| --- | --- | --- |
| `admin@example.com` | `admin1234` | admin |
| `analyst@example.com` | `analyst1234` | analyst |
| `user@example.com` | `user1234` | user |

Change these in production.

## Architecture

```
News sources ──► Ingest (RSS / sitemap / URL)
                       │
                       ▼
                APScheduler queue ──► NLP pipeline (spaCy + sbert)
                                          │
                                          ▼
                                    SQLite (articles, entities, relationships, embeddings)
                                          │
                                          ▼
                                FastAPI ─── React Flow graph
                                          ─── Search (FTS + semantic)
                                          ─── AI summaries / Q&A
```

## API summary

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | public | for analyst/user signups |
| POST | `/api/auth/login` | public | returns JWT |
| GET | `/api/articles` | user+ | paginated |
| GET | `/api/articles/{id}` | user+ | single article + extracted entities |
| GET | `/api/entities` | user+ | search/filter by type |
| GET | `/api/entities/{id}` | user+ | relationships, timeline, articles |
| GET | `/api/graph/{entity}` | user+ | subgraph (depth + filters) |
| POST | `/api/search` | user+ | `{q, mode: keyword/semantic/entity}` |
| POST | `/api/ask` | user+ | rule-based or OpenAI-backed Q&A |
| POST | `/api/ingest/sources` | admin | add an RSS/sitemap/URL source |
| GET | `/api/ingest/sources` | analyst+ | list sources |
| POST | `/api/ingest/run` | admin | trigger an immediate ingest pass |
| GET | `/api/watchlists` | analyst+ | list watchlists |
| POST | `/api/watchlists` | analyst+ | add an entity watchlist |
| GET | `/api/alerts` | analyst+ | recent alerts |

Full schema is auto-published at http://localhost:8000/docs.

## Production notes

- **Postgres** — change `DATABASE_URL` to `postgresql+psycopg://…` and run `alembic upgrade head` (Alembic stub included).
- **Embeddings** — `sentence-transformers/all-MiniLM-L6-v2` loads on first use; ~80 MB.
- **Rate limiting** — `slowapi` middleware applies `60/minute` per IP by default.
- **RBAC** — `admin`, `analyst`, `user`; enforced in router dependencies.

## Roadmap (post-MVP)

- Neo4j adapter
- Playwright crawler for JS-heavy sites
- HDBSCAN topic clustering
- Multilingual spaCy models
- WebSocket live alerts
- Misinformation detection

## License

MIT.
