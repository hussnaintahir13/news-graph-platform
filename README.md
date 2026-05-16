# NewroSense

> **News + Neuro = Newro.** A platform that builds **perceptions, context, and details** about every news story — not just headlines.

NewroSense ingests news, extracts the people, companies, countries, products and events behind each story, links them into a living entity-relationship graph, and surfaces the **meaning** under the headlines: who's connected to whom, how each story is evolving, and which signals are gaining momentum.

It is the successor to the earlier "News Graph Platform" / "AI News Relationship Map" MVP — same engine, sharper purpose.

## What NewroSense gives you

- **Perception** — every article is parsed into entities, sentiment, and typed relationships.
- **Context** — every entity links to its source articles, its connections, its timeline, and its position in the broader graph.
- **Details** — drill into any node, any edge, any sentence. Every signal is auditable.

## What's implemented

| Capability | Status | Notes |
| --- | --- | --- |
| News ingestion (RSS / sitemap / URL) | Done | `feedparser` + `httpx`; retries on failure |
| Article processing | Done | `trafilatura` for boilerplate removal |
| NLP extraction | Done | spaCy NER + sentence-level co-occurrence + sentence-transformer embeddings |
| **Entity canonicalization** | **New (Chunk 1)** | Legal-suffix stripping + alias table; "AAPL", "Apple Inc.", "Apple Computer" all resolve to one node |
| **Upgraded embeddings** | **New (Chunk 1)** | bge-small-en-v1.5 with automatic fallback to MiniLM-L6 |
| Relationship engine | Done | Confidence, dedup, edge weighting, temporal stamps |
| Graph visualisation | Done | React Flow — pan, zoom, expand to N hops, filter by edge type |
| Hybrid search | Done | SQLite FTS keyword + cosine semantic + entity-name match |
| AI Q&A | Done | OpenAI when `OPENAI_API_KEY` set; deterministic fallback otherwise |
| Live monitoring | Basic | Watchlists + recent-mentions alert. Trend detection arrives in Chunk 2. |
| Non-functional | Baseline | JWT auth, RBAC (`admin` / `analyst` / `user`), rate limiting, retries |

## What's planned (next chunks)

| Chunk | Features |
| --- | --- |
| **2** | Trend detection (z-score velocity + Kleinberg burst), hybrid search with cross-encoder reranking, typed relations via REBEL |
| **3** | Community detection (Louvain/Leiden) with coloured clusters, timeline scrubber + velocity-weighted node sizing, storyline clustering |

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

```bash
cd backend
.venv\Scripts\activate
python -m app.seeds
```

### Canonicalize existing entities (one-shot)

If you're upgrading from a previous install, run the entity backfill once to merge duplicate nodes ("Apple", "Apple Inc.", "AAPL" → one node):

```bash
cd backend
.venv\Scripts\activate
python -m app.services.entity_backfill
```

Then visit http://localhost:5000/explore.

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
                APScheduler queue ──► NLP pipeline (spaCy + bge-small)
                                          │       │
                                          │       └─► Entity canonicalization (alias table)
                                          ▼
                                    SQLite (articles, entities, aliases, relationships, embeddings)
                                          │
                                          ▼
                                FastAPI ─── React Flow graph
                                          ─── Search (FTS + semantic)
                                          ─── AI Q&A
                                          ─── Watchlists & alerts
```

## Embedding model

NewroSense defaults to **BAAI/bge-small-en-v1.5** (384-dim, ~130 MB, retrieves ~10–15 MTEB points better than the original MiniLM). If the model can't be downloaded, the service automatically falls back to `sentence-transformers/all-MiniLM-L6-v2` so the app keeps running.

Override via env:

```env
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
EMBEDDING_FALLBACK_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

## Migration from "News Graph Platform"

Existing SQLite files are named `newsgraph.db`. NewroSense uses `newrosense.db` by default. To keep your data:

```bash
mv backend/newsgraph.db backend/newrosense.db   # macOS/Linux
move backend\newsgraph.db backend\newrosense.db # Windows
python -m app.services.entity_backfill          # collapse duplicate entities
```

Or set `DATABASE_URL=sqlite:///./newsgraph.db` in `.env` to keep the old filename.

## API summary

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | public | for analyst/user signups |
| POST | `/api/auth/login` | public | returns JWT |
| GET | `/api/articles` | user+ | paginated |
| GET | `/api/articles/{id}` | user+ | article + entities |
| GET | `/api/entities` | user+ | search/filter by type |
| GET | `/api/entities/{id}` | user+ | relationships, timeline, articles, aliases |
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
- **Embeddings** — bge-small-en-v1.5 (~130 MB) downloads on first use; MiniLM fallback (~80 MB) kicks in if that fails.
- **Rate limiting** — `slowapi` middleware applies `60/minute` per IP by default.
- **RBAC** — `admin`, `analyst`, `user`; enforced in router dependencies.

## License

MIT.
