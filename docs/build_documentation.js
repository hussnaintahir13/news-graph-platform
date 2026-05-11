/**
 * Builds Technical_Documentation_v1.0.docx for the News Graph Platform.
 * Run: node build_documentation.js
 */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, ExternalHyperlink,
  TableOfContents, HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak,
} = require("docx");

// ---------- Helpers ----------
const DXA_INCH = 1440;
const PAGE_W = 12240;
const PAGE_H = 15840;
const CONTENT_W = PAGE_W - 2 * DXA_INCH;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

const para = (text, opts = {}) =>
  new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 120 } });

const codePara = (text) =>
  new Paragraph({
    children: [new TextRun({ text, font: "Consolas", size: 18 })],
    spacing: { before: 60, after: 120 },
    shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
  });

const codeBlock = (lines) =>
  lines.map(line =>
    new Paragraph({
      children: [new TextRun({ text: line || " ", font: "Consolas", size: 18 })],
      spacing: { before: 0, after: 0 },
      shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
    })
  );

const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)], pageBreakBefore: true });
const h1NoBreak = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const h3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });

const bullet = (text) =>
  new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: textRunsFromMd(text), spacing: { after: 60 } });
const bullet2 = (text) =>
  new Paragraph({ numbering: { reference: "bullets", level: 1 }, children: textRunsFromMd(text), spacing: { after: 60 } });

// Tiny markdown-ish parser: **bold** and `code` runs.
function textRunsFromMd(s) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0; let m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push(new TextRun(s.slice(last, m.index)));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true }));
    else out.push(new TextRun({ text: t.slice(1, -1), font: "Consolas", size: 18 }));
    last = m.index + t.length;
  }
  if (last < s.length) out.push(new TextRun(s.slice(last)));
  if (out.length === 0) out.push(new TextRun(s));
  return out;
}

// Two-column table (key/value)
function kvTable(rows, widths = [3120, 6240]) {
  return new Table({
    width: { size: widths[0] + widths[1], type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((r, i) =>
      new TableRow({
        children: r.map((c, j) =>
          new TableCell({
            borders,
            width: { size: widths[j], type: WidthType.DXA },
            shading: i === 0 ? { type: ShadingType.CLEAR, fill: "DBEAFE" } : undefined,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: textRunsFromMd(String(c ?? "")), spacing: { after: 0 } })],
          })
        ),
      })
    ),
  });
}

// Multi-column table with header row.
function gridTable(header, rows, widths) {
  const totalW = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: header.map((c, j) =>
          new TableCell({
            borders,
            width: { size: widths[j], type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "DBEAFE" },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: c, bold: true })], spacing: { after: 0 } })],
          })
        ),
      }),
      ...rows.map(r =>
        new TableRow({
          children: r.map((c, j) =>
            new TableCell({
              borders,
              width: { size: widths[j], type: WidthType.DXA },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: textRunsFromMd(String(c ?? "")), spacing: { after: 0 } })],
            })
          ),
        })
      ),
    ],
  });
}

// ---------- Sections ----------

// 1. Cover
const cover = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 600 },
    children: [new TextRun({ text: "News Graph Platform", bold: true, size: 56 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
    children: [new TextRun({ text: "Technical Documentation", size: 36 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
    children: [new TextRun({ text: "Version 1.0", size: 28, bold: true, color: "1D4ED8" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
    children: [new TextRun({ text: "Author: Syed Hussnain Tahir Sherazi", size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 4800 },
    children: [new TextRun({ text: "MVP release — published 2026", size: 22, italics: true, color: "64748B" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: "© 2026 Syed Hussnain Tahir Sherazi. All rights reserved.", size: 20 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: "Unauthorised reproduction, distribution or commercial use is prohibited.", size: 20 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Contact the author for licensing.", size: 20, italics: true })] }),
];

// 2. TOC
const toc = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Table of Contents")], pageBreakBefore: true }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
];

// 3. Executive Summary
const executive = [
  h1("1. Executive Summary"),
  para("News Graph Platform is an open-source MVP that continuously crawls news, extracts the people, companies, countries and events mentioned in each article, and stores the resulting entity-relationship network in a graph-shaped database. The platform exposes the graph through an interactive Next.js front-end where users can:"),
  bullet("Search across articles and entities (keyword, semantic, entity)."),
  bullet("Explore one entity's neighbourhood or analyse paths between two-plus entities."),
  bullet("Read AI-generated insight summaries that are strictly scoped to the slicer state of the current view."),
  bullet("Build evidence-chain arguments from cue-typed news relationships (admin / analyst only)."),
  bullet("Tell the platform their interests so that priority crawling is keyword-driven."),
  para("The system favours simple, swappable choices: SQLite for storage, APScheduler for ingestion, sentence-transformers + spaCy for NLP, FastAPI for the API, Next.js + React Flow for the UI. Each layer is a single seam so that, when scale demands it, the operator can swap in Postgres, Neo4j, Redis + Celery, Elasticsearch and Playwright without rewriting the rest of the app."),
  para("v1.0 is explicitly an MVP. The Known Flaws & Limitations and Where Things Are Static sections of this document enumerate every place the implementation is shallow, hard-coded or deferred."),
];

// 4. System Architecture
const arch = [
  h1("2. System Architecture"),
  para("The platform is a vertical slice of a news-graph pipeline, with seven layers operating in sequence on each scheduler tick:"),

  h2("2.1 Data flow"),
  ...codeBlock([
    "  Sources (RSS / sitemap / URL / Google News by interest keyword)",
    "       │",
    "       ▼",
    "  Crawlers (httpx + trafilatura; Playwright stub for JS-only sites)",
    "       │",
    "       ▼",
    "  APScheduler tick (every 180 min by default)",
    "       │",
    "       ▼",
    "  NLP pipeline",
    "    ├── spaCy NER (en_core_web_sm)",
    "    ├── Sentence-level co-occurrence",
    "    ├── Cue-regex relationship classifier",
    "    ├── Sentiment (positive/negative word lists)",
    "    └── sentence-transformers/all-MiniLM-L6-v2 embeddings (384-dim)",
    "       │",
    "       ▼",
    "  Storage (SQLite by default; Postgres-compatible)",
    "    Article · Entity · Relationship_ · ArticleEntity · Source",
    "    User · Interest · Watchlist · Alert",
    "       │",
    "       ▼",
    "  API (FastAPI · JWT · RBAC admin/analyst/user · slowapi 60/min)",
    "       │",
    "       ▼",
    "  Frontend (Next.js 15 · Tailwind · React Flow · TypeScript)",
    "       │",
    "       ▼",
    "  AI (optional OpenAI; deterministic fallback when key unset)",
  ]),

  h2("2.2 Responsibility seams"),
  para("Every external concern is concentrated in a single service module so it can be replaced without touching callers."),
  gridTable(
    ["Concern", "Module", "Swap-in"],
    [
      ["Graph storage", "`backend/app/services/graph_service.py`", "Neo4j adapter"],
      ["Search", "`backend/app/services/search_service.py`", "Elasticsearch / Typesense / pgvector"],
      ["Ingestion", "`backend/app/services/ingest_service.py`", "Add Playwright for JS-rendered sites"],
      ["Scheduler", "`backend/app/jobs/scheduler.py`", "Celery + Redis for distributed workers"],
      ["Vector ops", "`backend/app/services/embedding_service.py`", "pgvector / Elasticsearch dense_vector"],
      ["AI summarisation", "`backend/app/services/ai_service.py`", "Different LLM provider"],
    ],
    [2400, 4400, 2560]
  ),
];

// 5. Tech stack
const stack = [
  h1("3. Tech Stack"),
  gridTable(
    ["Layer", "Library", "Version", "Purpose"],
    [
      ["API", "FastAPI", "0.115", "HTTP + OpenAPI"],
      ["ORM", "SQLAlchemy", "2.0", "Models + sessions"],
      ["Auth", "python-jose + passlib + bcrypt", "—", "JWT (HS256) + bcrypt hashes"],
      ["NLP — NER", "spaCy + en_core_web_sm", "3.7", "Named-entity recognition"],
      ["NLP — embeddings", "sentence-transformers/all-MiniLM-L6-v2", "—", "384-dim vectors"],
      ["Crawler", "httpx + feedparser + trafilatura", "—", "Static-HTML article extraction"],
      ["Scheduler", "APScheduler", "3.10", "In-process recurring jobs"],
      ["Rate limit", "slowapi", "0.1", "60/minute per IP"],
      ["Database", "SQLite (default)", "—", "Embedded; Postgres-ready"],
      ["Frontend", "Next.js + React + TypeScript", "15 / 18", "App Router SPA"],
      ["Styling", "Tailwind CSS", "3.4", "Design tokens"],
      ["Graph UI", "React Flow", "11", "Pan / zoom / minimap"],
      ["AI (opt.)", "OpenAI SDK", "1.54", "Q&A / hypothesis polish"],
    ],
    [1800, 3200, 1400, 2960]
  ),
];

// 6. Data model
const dataModel = [
  h1("4. Data Model"),
  para("All models live in `backend/app/models.py`. Primary keys are 32-char hex UUIDs. Indexes shown reflect what is actually declared in the code; SQLite auto-indexes primary keys and unique constraints."),

  h2("4.1 User"),
  gridTable(["Column", "Type", "Notes"], [
    ["id", "string(32) PK", "uuid4 hex"],
    ["email", "string(255), unique, indexed", "login identifier"],
    ["password_hash", "string(255)", "bcrypt (passlib 1.7.4 + bcrypt 4.0.1)"],
    ["role", "string(20)", "`admin` / `analyst` / `user`"],
    ["created_at", "datetime", ""],
  ], [2200, 3160, 4000]),

  h2("4.2 Source"),
  gridTable(["Column", "Type", "Notes"], [
    ["id", "string(32) PK", ""],
    ["name", "string(255)", "Display label"],
    ["kind", "string(20)", "`rss` / `sitemap` / `url`"],
    ["url", "string(1024), unique", ""],
    ["enabled", "bool", "Skip when disabled"],
    ["last_run_at", "datetime, nullable", "Updated on each ingest pass"],
    ["created_at", "datetime", ""],
  ], [2200, 3160, 4000]),

  h2("4.3 Article"),
  gridTable(["Column", "Type", "Notes"], [
    ["id", "string(32) PK", ""],
    ["title / content / summary / author / source / url / image_url / published_at", "text + datetime", "`url` is unique"],
    ["sentiment", "float, nullable", "[-1, 1] from word-list scorer"],
    ["embedding", "JSON (list[float])", "384-dim; SQLite-stored as JSON"],
    ["processed", "bool, indexed", "Set true after NLP runs"],
    ["created_at", "datetime, indexed", ""],
  ], [2400, 3960, 3000]),

  h2("4.4 Entity"),
  gridTable(["Column", "Type", "Notes"], [
    ["id", "string(32) PK", ""],
    ["name / name_norm", "string(255)", "`name_norm` is lower-cased, whitespace-collapsed"],
    ["type", "string(40), indexed", "`Person` / `Company` / `Country` / etc., plus the manually-added `Concept` type"],
    ["description", "text, nullable", "Generated once on first entity-page view, then cached"],
    ["embedding", "JSON (list[float])", "Entity-name embedding"],
    ["mentions", "int", "Total occurrence count across articles"],
    ["Unique constraint", "(name_norm, type)", "Prevents duplicate entities"],
  ], [2200, 3160, 4000]),

  h2("4.5 ArticleEntity"),
  gridTable(["Column", "Type", "Notes"], [
    ["id", "string(32) PK", ""],
    ["article_id", "FK → articles.id (CASCADE)", ""],
    ["entity_id", "FK → entities.id (CASCADE)", ""],
    ["occurrences", "int", "Within-article mention count"],
    ["Unique constraint", "(article_id, entity_id)", ""],
  ], [2200, 3160, 4000]),

  h2("4.6 Relationship_"),
  para("Trailing underscore avoids collision with SQLAlchemy's `relationship` helper."),
  gridTable(["Column", "Type", "Notes"], [
    ["id", "string(32) PK", ""],
    ["source_entity / target_entity", "FK → entities.id", "Stored in lexical order (canonicalised)"],
    ["relation_type", "string(60), indexed", "One of the cue verbs or `MENTIONED_WITH`"],
    ["confidence", "float", "0.45 fallback, 0.75 cue-match"],
    ["weight", "float", "Accumulates on co-occurrence"],
    ["article_id", "FK → articles.id (SET NULL)", "Audit trail back to source"],
    ["observed_at / created_at", "datetime, indexed", ""],
  ], [2400, 3160, 3800]),

  h2("4.7 Watchlist"),
  gridTable(["Column", "Type", "Notes"], [
    ["id / user_id / entity_id / created_at", "—", "Many-to-many join table"],
  ], [2200, 3160, 4000]),

  h2("4.8 Alert"),
  gridTable(["Column", "Type", "Notes"], [
    ["id / user_id / entity_id / article_id / reason / created_at / seen", "—", "Created when a watched entity appears in a newly-ingested article"],
  ], [2200, 3160, 4000]),

  h2("4.9 Interest"),
  gridTable(["Column", "Type", "Notes"], [
    ["id / user_id", "—", ""],
    ["keyword / keyword_norm", "string(255)", "Normalised form used for dedup"],
    ["priority", "int (default 5)", "Higher = processed earlier on scheduler tick"],
    ["created_at", "datetime", ""],
    ["Unique constraint", "(user_id, keyword_norm)", ""],
  ], [2200, 3160, 4000]),
];

// 7. NLP
const nlp = [
  h1("5. NLP Pipeline"),
  para("All NLP runs in `backend/app/services/nlp_service.py` and `processing_service.py`."),

  h2("5.1 Entity recognition"),
  para("spaCy `en_core_web_sm` is loaded lazily on first use. Recognised labels are mapped to platform types:"),
  gridTable(["spaCy label", "Platform type"], [
    ["PERSON", "Person"], ["ORG / NORP / FAC", "Organization"], ["GPE / LOC", "Country"],
    ["PRODUCT / WORK_OF_ART", "Product"], ["EVENT", "Event"],
  ], [3120, 6240]),

  h2("5.2 Relationship classification"),
  para("Each sentence is scanned for cue verbs. If a cue pattern matches, the relationship gets that verb's label with confidence 0.75; otherwise pairs of co-occurring entities receive `MENTIONED_WITH` with confidence 0.45."),
  gridTable(["Cue label", "Regex"], [
    ["ACQUIRED",    "\\b(acquired|acquires|acquisition of|bought)\\b"],
    ["INVESTED_IN", "\\b(invested in|invests in|investment in|backed|funding for)\\b"],
    ["PARTNERED",   "\\b(partner(ed|s)? with|partnership with|teamed up with|joint venture)\\b"],
    ["ANNOUNCED",   "\\b(announced|unveiled|launched|introduces)\\b"],
    ["REGULATED",   "\\b(regulator(y|s)?|fined|sanctioned|regulated)\\b"],
    ["ATTACKED",    "\\b(attacked|strike on|hacked|breached)\\b"],
    ["SUED",        "\\b(sued|sues|lawsuit|filed suit against)\\b"],
  ], [2400, 6960]),

  h2("5.3 Sentiment"),
  para("`_sentiment(text)` computes (pos - neg) / (pos + neg) using two 30-ish word lists. The output range is [-1, 1] and is stored on the Article row. This is a deliberately tiny lexicon — see Known Flaws."),

  h2("5.4 Embeddings"),
  para("`sentence-transformers/all-MiniLM-L6-v2` is loaded once and cached. Each article gets an embedding of its title + first 2000 chars; each entity gets an embedding of its name. Cosine similarity is implemented in `embedding_service.cosine()`."),

  h2("5.5 Topic clustering — not implemented"),
  para("The original spec called for HDBSCAN clustering of article embeddings. v1.0 ships without it; this is listed in the Roadmap."),
];

// 8. Graph service
const graph = [
  h1("6. Graph Service"),
  para("All graph operations are in `backend/app/services/graph_service.py`. There is no Neo4j layer in v1.0; the same module provides:"),
  bullet("`upsert_entity / upsert_article_entity / upsert_relationship` — idempotent writers used by the NLP processing pass."),
  bullet("`neighbourhood(entity_id, depth, limit)` — BFS subgraph for the Single-seed view of `/explore`."),
  bullet("`multi_neighbourhood(entity_ids, depth, limit)` — union neighbourhood of several seeds plus the cross-edges between them."),
  bullet("`find_paths(src, dst, max_hops, max_paths)` — BFS over an in-memory undirected adjacency built once per request. Returns shortest paths first."),
  bullet("`degree_centrality(top)` — degree-based ranking of the most connected entities; powers Trending and the home page."),
  bullet("`entity_similarity(entity_id)` — cosine ranking over entity embeddings restricted to the same type."),
];

// 9. Ingestion
const ingest = [
  h1("7. Ingestion & Scheduling"),
  h2("7.1 Source kinds"),
  bullet("**RSS** — parsed with `feedparser`; each entry's link is followed."),
  bullet("**Sitemap** — `<loc>` URLs extracted with BeautifulSoup (xml parser); top 25 used."),
  bullet("**URL** — a single article fetched directly."),
  h2("7.2 Crawl mechanics"),
  bullet("HTTP client: `httpx`, 20-second timeout, 3 retries with logging."),
  bullet("Boilerplate removal: `trafilatura.extract` (JSON output, includes metadata). Fallback to BeautifulSoup `<p>` concatenation when trafilatura fails."),
  bullet("Deduplication: `articles.url` is unique; re-ingestion skips duplicates."),
  bullet("Per-source cap: 25 entries per RSS feed / sitemap."),
  bullet("JS-rendered sites: `_fetch_playwright()` is stubbed; JS-only SPAs are not crawled in v1.0."),
  h2("7.3 Scheduler tick"),
  para("`backend/app/jobs/scheduler.py` runs every `SCHEDULER_INTERVAL_MINUTES` minutes (default 180 — three hours). Each tick does:"),
  ...codeBlock([
    "interests_service.ingest_interests(db)     # Google News RSS for each unique user-interest keyword",
    "ingest_service.ingest_all(db)               # all admin-configured sources",
    "processing_service.process_unprocessed(db)  # NLP + embeddings + graph upsert",
  ]),
];

// 10. Interest-driven crawl
const interests = [
  h1("8. Interest-Driven Priority Crawling"),
  para("Users register keywords (people, places, topics) on `/interests`. On every scheduler tick the platform aggregates the distinct keywords across every user and fetches a Google News search RSS feed for each one:"),
  codePara("https://news.google.com/rss/search?q=<KEYWORD>&hl=en-US&gl=US&ceid=US:en"),
  para("Articles returned are passed through the same ingest pipeline and labelled with `source = '<domain> (interest: <keyword>)'` so it's visible in the article list. Admins can disable or remove individual sources via the Admin page; user interests are stored per-user but are aggregated for crawling."),
];

// 11. AI subsystem
const ai = [
  h1("9. AI Subsystem"),
  para("Every AI call is optional. If `OPENAI_API_KEY` is set the platform polishes deterministic output with OpenAI; if it is unset the deterministic version is final."),

  h2("9.1 Q&A — POST /api/ask"),
  para("Pulls top semantic matches across all articles, attaches scoring entity candidates, sends to OpenAI with a strict 'use only this context, hedge appropriately' system prompt. Falls back to TF-scored extractive summary when no key is present."),

  h2("9.2 Scoped insights — POST /api/insights/scoped"),
  para("Used by the InsightsPanel under the Explore graph. The request includes the visible edge IDs from the React Flow canvas. The service:"),
  bullet("Resolves visible edges → backing `article_id`s — the only articles considered."),
  bullet("If zero edges have article references, falls back to the subject's own articles and labels the fallback in the answer."),
  bullet("Builds a deterministic structured paragraph naming the visible connected entities and the ledes of up to three supporting articles."),
  bullet("Auto-fires on the front-end whenever a slicer changes (debounced 600ms); stale answers are cleared instantly so the user never reads text that doesn't match the slicers."),

  h2("9.3 Hypothesis — POST /api/hypothesis"),
  para("Powers `/explore?mode=multi`. For every pair of selected entities the service finds up to three shortest paths through the graph, gathers supporting articles, and renders a deterministic narrative. When OpenAI is configured the narrative is polished into a single hedged paragraph."),

  h2("9.4 Argument — POST /api/argument"),
  para("Gated to admin and analyst roles. Builds an explicit chained-evidence claim from a subject, an outcome and an optional intermediate theme."),
  bullet("Rejects any candidate chain that contains a `MENTIONED_WITH` edge."),
  bullet("Rejects chains whose weakest edge falls below the configurable `min_confidence`."),
  bullet("Extracts the exact source sentence behind every edge as an audit quote."),
  bullet("Picks one of five fixed templates: **facilitation**, **association**, **beneficiary**, **collaboration**, **linkage**."),
  bullet("Emits a hedged conclusion only (\"may have facilitated\" / \"may stand to benefit\" — never \"is\")."),
  bullet("The UI shows a persistent disclaimer banner and requires the user to tick \"I will not publish or share this without independent verification\" before the request fires."),
];

// 12. API reference
const apiRef = [
  h1("10. API Reference"),
  para("All routes are namespaced under `/api`. Bearer-token JWT auth on every route except `/health` and `/auth/*`. OpenAPI is auto-published at `http://<host>:8000/docs`."),

  h2("10.1 Auth"),
  gridTable(
    ["Method", "Path", "Role", "Body"],
    [
      ["POST", "/api/auth/register", "public", "`{ email, password, role? }` — role ignored if `admin`"],
      ["POST", "/api/auth/login", "public", "form-encoded `username / password` → `{ access_token, user }`"],
    ],
    [1100, 3300, 1400, 3560]
  ),

  h2("10.2 Content"),
  gridTable(
    ["Method", "Path", "Role", "Notes"],
    [
      ["GET", "/api/articles", "user+", "`offset`, `limit`, optional `source`"],
      ["GET", "/api/articles/{id}", "user+", "Detail incl. entity chips"],
      ["GET", "/api/entities", "user+", "`q`, `type`, `limit`"],
      ["POST", "/api/entities", "admin / analyst", "Manually create `Concept` entity"],
      ["GET", "/api/entities/{id}", "user+", "Full profile + relationships + timeline"],
      ["POST", "/api/search", "user+", "`{ q, mode: keyword/semantic/entity, limit }`"],
      ["GET", "/api/health", "public", "Liveness"],
    ],
    [900, 2600, 1700, 4160]
  ),

  h2("10.3 Graph"),
  gridTable(
    ["Method", "Path", "Role", "Notes"],
    [
      ["GET", "/api/graph/{id}", "user+", "Subgraph; `depth`, `limit`"],
      ["GET", "/api/graph/top/centrality", "user+", "`top`"],
      ["POST", "/api/graph/multi", "user+", "Union neighbourhood; `{ entity_ids, depth, limit }`"],
      ["GET", "/api/graph/path/{src}/{dst}", "user+", "BFS paths; `max_hops`, `max_paths`"],
    ],
    [900, 3000, 1700, 3760]
  ),

  h2("10.4 AI"),
  gridTable(
    ["Method", "Path", "Role", "Notes"],
    [
      ["POST", "/api/ask", "user+", "`{ question }`"],
      ["POST", "/api/insights/scoped", "user+", "`{ subject_id, relationship_ids, entity_ids, rel_type_filter, entity_type_filter }`"],
      ["POST", "/api/hypothesis", "user+", "`{ entity_ids, max_hops, max_paths_per_pair }`"],
      ["POST", "/api/argument", "admin / analyst", "`{ subject_id, outcome_id, theme_id?, max_hops, min_confidence }`"],
      ["GET", "/api/explain/{a}/{b}", "user+", "Raw recorded relationships between two entities"],
    ],
    [900, 3000, 1700, 3760]
  ),

  h2("10.5 Ingestion & sources"),
  gridTable(
    ["Method", "Path", "Role", "Notes"],
    [
      ["GET", "/api/ingest/sources", "admin / analyst", "List"],
      ["POST", "/api/ingest/sources", "admin", "`{ name, kind, url, enabled }`"],
      ["DELETE", "/api/ingest/sources/{id}", "admin", ""],
      ["POST", "/api/ingest/run", "admin", "Background ingest pass"],
    ],
    [900, 3000, 1700, 3760]
  ),

  h2("10.6 Watchlists / alerts / interests"),
  gridTable(
    ["Method", "Path", "Role", "Notes"],
    [
      ["GET", "/api/watchlists", "admin / analyst", "List"],
      ["POST", "/api/watchlists", "admin / analyst", "`{ entity_id }`"],
      ["DELETE", "/api/watchlists/{id}", "admin / analyst", ""],
      ["GET", "/api/alerts", "admin / analyst", "Recent 50"],
      ["GET", "/api/interests", "user+", ""],
      ["POST", "/api/interests", "user+", "`{ keyword, priority }`"],
      ["DELETE", "/api/interests/{id}", "user+", ""],
    ],
    [900, 3000, 1700, 3760]
  ),
];

// 13. Frontend IA
const frontend = [
  h1("11. Frontend Information Architecture"),
  para("Built with Next.js 15 App Router, Tailwind CSS and React Flow. Lives in `frontend/src/app/**` and `frontend/src/components/**`."),

  h2("11.1 Layout"),
  bullet("**TopBar** (`components/TopBar.tsx`): logo + 4 primary destinations (Home, Explore, Library, Insights) + user widget (avatar / email / role / sign-out). The primary destinations collapse below the `md` breakpoint."),
  bullet("**Sidebar drawer** (`components/Sidebar.tsx`): hamburger-triggered overlay drawer. Hosts My interests, Build argument (admin / analyst only), Watchlists, Admin (admin only) and How it works. On mobile this drawer is the single navigation source of truth."),
  bullet("**Footer** (`components/Footer.tsx`): copyright + contact-for-licensing line."),

  h2("11.2 Page map"),
  gridTable(
    ["Route", "Purpose", "Replaces"],
    [
      ["/", "Dashboard / landing", "—"],
      ["/explore", "Single-seed graph **and** multi-entity Connect (mode toggle)", "old /graph, /connect"],
      ["/library", "Articles list + search modes (All / Keyword / Semantic / Entity)", "old /articles, /search"],
      ["/insights", "Plain-English Ask AI", "old /ask"],
      ["/interests", "Per-user interest keywords", "—"],
      ["/watchlists", "Watched entities + alerts", "—"],
      ["/admin", "Source configuration + Run-ingest button", "—"],
      ["/argument", "Chained-evidence argument builder (admin / analyst)", "—"],
      ["/how-to", "User guide + FAQ + SVG process diagram", "—"],
      ["/entities/[id]", "Entity profile", "—"],
      ["/articles/[id]", "Article detail + extracted entities", "—"],
      ["/login, /register", "Auth", "—"],
      ["/graph, /connect, /articles, /search, /ask", "`redirect()` to the new routes", "—"],
    ],
    [2400, 5000, 1960]
  ),

  h2("11.3 Key components"),
  bullet("`AppShell` — wraps every page, holds drawer state."),
  bullet("`GraphCanvas` — radial layout, depth + entity-type + relationship-type slicers, legend, minimap. Emits the live filtered view to its parent via `onUpdate`."),
  bullet("`InsightsPanel` — filter-aware deterministic + AI summary, auto-fires on slicer change."),
  bullet("`EntityAutocomplete` — keyboard-navigable single-entity picker."),
  bullet("`EntityMultiSelect` — chip-style picker with \"Add as new Concept\" affordance for admin / analyst."),
  bullet("`ProcessFlow` — SVG process diagram on `/how-to`."),
];

// 14. Auth
const auth = [
  h1("12. Authentication & Authorisation"),
  para("Auth is implemented in `backend/app/auth.py`."),
  bullet("**Algorithm:** JWT HS256."),
  bullet("**Expiry:** 720 minutes (12 hours) — env-tunable via `JWT_EXPIRY_MINUTES`."),
  bullet("**Hash:** bcrypt via passlib 1.7.4 with bcrypt 4.0.1 pinned (passlib is incompatible with bcrypt ≥4.1)."),
  bullet("**Roles:** `admin`, `analyst`, `user`. The dependency `require_roles(*allowed)` is applied per-route; the front-end mirrors role gating in the navbar / sidebar."),
  bullet("**Default seed accounts** (created by `python -m app.seeds`):"),
  ...codeBlock([
    "admin@example.com   / admin1234   (admin)",
    "analyst@example.com / analyst1234 (analyst)",
    "user@example.com    / user1234    (user)",
  ]),
  para("These defaults MUST be changed before any non-local deployment."),
];

// 15. Configuration
const config = [
  h1("13. Configuration"),
  para("All settings are in `backend/.env` (a copy of `.env.example`). Loaded via pydantic-settings."),
  gridTable(["Variable", "Default", "Purpose"], [
    ["DATABASE_URL", "`sqlite:///./newsgraph.db`", "Engine URL"],
    ["JWT_SECRET", "placeholder", "**Change for production**"],
    ["JWT_ALG", "HS256", ""],
    ["JWT_EXPIRY_MINUTES", "720", "12 hours"],
    ["CORS_ORIGINS", "`localhost:5000, 127.0.0.1:5000`", "Comma-separated origins"],
    ["OPENAI_API_KEY", "(empty)", "Enables AI polish when set"],
    ["OPENAI_MODEL", "gpt-4o-mini", ""],
    ["SCHEDULER_ENABLED", "true", ""],
    ["SCHEDULER_INTERVAL_MINUTES", "180", "Three-hour tick"],
    ["EMBEDDING_MODEL", "all-MiniLM-L6-v2", ""],
    ["SPACY_MODEL", "en_core_web_sm", ""],
    ["RATE_LIMIT", "60/minute", "slowapi per-IP bucket"],
  ], [3000, 3360, 3000]),
];

// 16. Deployment
const deploy = [
  h1("14. Deployment"),
  h2("14.1 Local development"),
  ...codeBlock([
    "# backend (port 8000)",
    "cd backend",
    ".venv\\Scripts\\activate",
    "uvicorn app.main:app --host 127.0.0.1 --port 8000",
    "",
    "# frontend (port 5000)",
    "cd frontend",
    "npm run dev",
  ]),

  h2("14.2 Docker Compose"),
  para("`docker-compose.yml` ships at the repository root and starts both services with a single command:"),
  codePara("docker compose up --build"),
  para("Mounts a named volume for the SQLite database. Replace `DATABASE_URL` with a Postgres URL to run against a managed database; the SQLAlchemy layer is identical."),

  h2("14.3 Production swap-in checklist"),
  gridTable(["Concern", "Swap"], [
    ["Database", "Postgres + Alembic migrations"],
    ["Graph backend", "Neo4j (`graph_service.py` is the only seam)"],
    ["Queue", "Celery + Redis (`jobs/scheduler.py`)"],
    ["Search", "Elasticsearch / Typesense (`search_service.py`)"],
    ["Crawler", "Playwright (`ingest_service._fetch_playwright` is stubbed)"],
    ["Reverse proxy", "Nginx + Let's Encrypt"],
    ["Secrets", "AWS SSM / Vault / Doppler"],
    ["Logging", "Loki / OpenSearch / CloudWatch"],
    ["Observability", "Prometheus + Grafana + Sentry"],
  ], [2600, 6760]),
];

// 17. KNOWN FLAWS
const flaws = [
  h1("15. Known Flaws & Limitations"),
  para("This section is deliberately exhaustive. v1.0 is an MVP and these are real limitations, not theoretical risks."),

  h2("15.1 NLP"),
  bullet("**Relationship extraction is shallow.** The cue-regex layer matches only seven verb classes. The majority of extracted edges fall back to `MENTIONED_WITH`, which is mere co-occurrence — **not** evidence of causation. This is the headline NLP weakness and the reason the Argument feature refuses to assemble chains that include `MENTIONED_WITH` edges."),
  bullet("**Sentiment is a tiny word-list.** Around 30 positive + 30 negative tokens. Will misclassify nuance, sarcasm and negation (\"not bad\")."),
  bullet("**English-only.** spaCy `en_core_web_sm` only. Non-English news is silently mis-extracted."),

  h2("15.2 Crawling"),
  bullet("**No JS-rendered crawl.** trafilatura works on static HTML; SPAs are not crawled. The Playwright hook is stubbed."),
  bullet("**Article content is stored verbatim.** This is fine for personal / research use but raises copyright considerations if the platform is served to the public."),

  h2("15.3 Storage & scale"),
  bullet("**SQLite for the graph.** Works up to ~10M edges; beyond that read latency degrades. Neo4j is the documented swap but is not wired."),
  bullet("**Path-finding loads the entire edge table** into a Python adjacency list on every call. Will not scale beyond ~50K edges without optimisation."),
  bullet("**Vector search is a Python cosine loop** over up to 500 candidate rows. At larger scale move to pgvector or Elasticsearch dense_vector."),
  bullet("**No cache layer.** Every request hits SQLite; Redis is suggested as a swap but not wired."),
  bullet("**APScheduler is in-process.** A restart loses any work in-flight; there is no distributed worker fleet."),

  h2("15.4 AI"),
  bullet("**Deterministic fallback is structured but thin.** Reads well on clear English ledes; struggles with long or paywalled articles."),
  bullet("**OpenAI calls are not retried, not internally rate-limited, not cached.** With `OPENAI_API_KEY` set, the InsightsPanel auto-fires on every slicer change — costs can stack up. The 60/min slowapi limit applies but per-user OpenAI usage is not tracked."),
  bullet("**Argument templates are five fixed strings.** Limited rhetorical range; very different chains may produce identical phrasing."),

  h2("15.5 Operational maturity"),
  bullet("**No tests.** No pytest, Jest or Cypress as of v1.0."),
  bullet("**No CI.** No GitHub Actions workflow."),
  bullet("**No telemetry.** Prometheus / Grafana / Sentry are suggested in the original spec but not wired."),

  h2("15.6 Security"),
  bullet("**JWT_SECRET defaults to a placeholder** in dev. If unchanged for prod, anyone can forge tokens."),
  bullet("**CORS defaults to localhost** — must be reconfigured for the prod domain before deployment."),
  bullet("**Rate limit is per-IP, not per-user.** Behind a proxy that does not forward client IP, the whole tenant shares one bucket."),
  bullet("**No password-reset, no email verification, no MFA.**"),
  bullet("**No CSRF protection beyond JWT bearer.** Acceptable for separate-origin SPA, but a hazard if same-origin cookies are introduced later."),
  bullet("**Hydration mismatch is suppressed at `<html>` and `<body>`** to ignore browser-extension attributes. Genuine mismatches elsewhere are still flagged, but the suppression weakens the safety net."),

  h2("15.7 UX"),
  bullet("**No admin UI to edit entities or relationships.** Only ingestion + the ad-hoc \"Add as new Concept\" affordance."),
  bullet("**No undo for delete operations** (sources, watchlists, interests)."),
];

// 18. STATIC
const staticParts = [
  h1("16. Where Things Are Static"),
  para("The following surfaces are hard-coded in v1.0 and do not adapt at runtime. Every one is a candidate for being made configurable in a future release."),

  gridTable(["Surface", "What is static"], [
    ["Entity description", "Generated on first entity-page view and then cached on the row. Does not refresh as new articles arrive."],
    ["Sentiment lexicon", "Two ~30-word lists in `nlp_service.py`."],
    ["spaCy → platform type mapping", "`SPACY_TO_TYPE` dict in `nlp_service.py`."],
    ["Relationship cue regex", "Seven entries in `RELATION_PATTERNS`."],
    ["Confidence floors", "Cue match = 0.75, fallback = 0.45 — constant."],
    ["Argument templates", "Five fixed strings — `facilitation`, `association`, `beneficiary`, `collaboration`, `linkage`."],
    ["Trending entities (Explore landing)", "Pulled from degree centrality at page load; no auto-refresh while on page."],
    ["InsightsPanel deterministic phrasing", "Rule-based string composer; updates with slicers but doesn't learn from usage."],
    ["Suggested AI questions (/insights)", "Four hard-coded prompts."],
    ["Quick-add interest chips (/interests)", "Fourteen hard-coded keywords."],
    ["Quick-add source presets (/admin)", "Six hard-coded RSS feeds."],
    ["Footer copyright text", "Hard-coded in `Footer.tsx`."],
    ["Default user accounts", "Seeded once via `python -m app.seeds`. If removed, must be reseeded manually."],
  ], [3200, 6160]),
];

// 19. Roadmap
const roadmap = [
  h1("17. Roadmap"),
  para("Post-v1.0 work items, in priority order:"),
  bullet("**Transformer-based relation extractor** to replace the cue-regex layer. Would dramatically improve the Argument feature's hit rate."),
  bullet("**HDBSCAN topic clustering** of article embeddings."),
  bullet("**Multilingual spaCy models** (start with es / fr / de)."),
  bullet("**Neo4j adapter** wired in behind the `graph_service` interface."),
  bullet("**Postgres + pgvector migration** documented step-by-step."),
  bullet("**WebSocket push** for live watchlist alerts."),
  bullet("**Misinformation / cross-source corroboration scoring** alongside the existing confidence floor."),
  bullet("**Tests + CI** (pytest backend, Jest + Playwright frontend, GitHub Actions)."),
  bullet("**Per-user OpenAI usage tracking** to control cost when the InsightsPanel auto-fires."),
  bullet("**Email verification, password reset, MFA** for production accounts."),
];

// 20. Licence
const licence = [
  h1("18. Licence"),
  para("News Graph Platform v1.0 is released under the MIT licence with an attribution rider:"),
  para("© 2026 Syed Hussnain Tahir Sherazi. All rights reserved."),
  para("Permission to use, copy, modify and distribute is granted under MIT, subject to:"),
  bullet("Retaining the attribution \"News Graph Platform — original work by Syed Hussnain Tahir Sherazi\" in derivative works, marketing material, and any public deployment of the software."),
  bullet("Not implying endorsement by the author."),
  bullet("For any commercial use beyond evaluation, please contact the author for written permission."),
  para("Unauthorised reproduction, distribution or commercial use is prohibited. The author reserves the right to revoke licence for misuse, including the publication of unverified or defamatory output generated by the Argument feature."),
];

// ---------- Doc assembly ----------

const doc = new Document({
  creator: "Syed Hussnain Tahir Sherazi",
  title: "News Graph Platform — Technical Documentation",
  description: "News Graph Platform v1.0 — technical documentation",

  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: "0B1220" },
        paragraph: { spacing: { before: 360, after: 220 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "1D4ED8" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "374151" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ],
  },

  numbering: {
    config: [
      { reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
        ]
      },
    ],
  },

  sections: [{
    properties: {
      page: {
        size: { width: PAGE_W, height: PAGE_H },
        margin: { top: DXA_INCH, right: DXA_INCH, bottom: DXA_INCH, left: DXA_INCH },
      },
    },
    headers: {
      default: new Header({ children: [
        new Paragraph({ alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "News Graph Platform — Technical Documentation v1.0", size: 18, color: "64748B" })] })
      ] })
    },
    footers: {
      default: new Footer({ children: [
        new Paragraph({ alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "© 2026 Syed Hussnain Tahir Sherazi · All rights reserved · Page ", size: 18, color: "64748B" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "64748B" }),
          ] })
      ] })
    },
    children: [
      ...cover,
      ...toc,
      ...executive,
      ...arch,
      ...stack,
      ...dataModel,
      ...nlp,
      ...graph,
      ...ingest,
      ...interests,
      ...ai,
      ...apiRef,
      ...frontend,
      ...auth,
      ...config,
      ...deploy,
      ...flaws,
      ...staticParts,
      ...roadmap,
      ...licence,
    ],
  }],
});

const out = path.join(__dirname, "Technical_Documentation_v1.0.docx");
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(out, buf);
  console.log("Wrote", out, buf.length, "bytes");
});
