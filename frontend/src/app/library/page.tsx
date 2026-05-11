"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Article, SearchHit } from "@/types";
import { IArticle, IFilter, IInfo, ILibrary, ISearch, ITag } from "@/components/Icons";

type Mode = "all" | "keyword" | "semantic" | "entity";

function LibraryInner() {
  const params = useSearchParams();
  const router = useRouter();
  const urlQ = params.get("q") || "";
  const urlMode = (params.get("mode") as Mode) || (urlQ ? "keyword" : "all");

  const [q, setQ] = useState(urlQ);
  const [mode, setMode] = useState<Mode>(urlMode);
  const [items, setItems] = useState<Article[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  const [source, setSource] = useState<string>("");

  // Sources for filter dropdown
  const knownSources = useMemo(() => {
    const set = new Set<string>();
    items.forEach(a => a.source && set.add(a.source));
    return ["", ...Array.from(set).sort()];
  }, [items]);

  useEffect(() => {
    if (mode === "all") loadAll();
    else if (urlQ) run(urlQ);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  useEffect(() => {
    if (mode === "all") loadAll();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [offset, source, mode]);

  async function loadAll() {
    setBusy(true);
    try {
      const articles = await api.articles(offset, 20);
      setItems(source ? articles.filter(a => a.source === source) : articles);
      setHits([]);
    } finally { setBusy(false); }
  }

  async function run(query?: string) {
    const v = (query ?? q).trim();
    if (!v) { setMode("all"); setHits([]); return; }
    const searchMode = mode === "all" ? "keyword" : mode;
    setQ(v); setBusy(true);
    router.replace(`/library?mode=${searchMode}&q=${encodeURIComponent(v)}`);
    try {
      const res = await api.search(v, searchMode);
      setHits(res);
    } finally { setBusy(false); }
  }

  function switchMode(next: Mode) {
    setMode(next);
    if (next === "all") {
      setHits([]); setQ("");
      router.replace("/library");
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <header>
        <div className="flex items-baseline gap-2">
          <ILibrary size={22} className="text-accent"/>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Library</h1>
        </div>
        <p className="text-sm text-muted mt-1 max-w-3xl">
          Browse every article the platform has ingested, or run a keyword / semantic / entity search.
        </p>
      </header>

      {/* Search bar */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <ISearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/>
            <input
              className="input pl-9"
              placeholder="Search articles or entities…"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && run()}
            />
          </div>
          <button className="btn-primary" onClick={() => run()} disabled={busy || !q.trim()}>
            {busy ? "…" : <><ISearch size={14}/> Search</>}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-muted">Mode</span>
          {(["all", "keyword", "semantic", "entity"] as Mode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)}
                    className={"px-3 py-1 rounded-full text-xs border transition " +
                      (mode === m
                        ? "bg-accent text-white border-accent"
                        : "bg-white text-slate-700 border-slate-200 hover:border-accent")}>
              {m === "all" ? "All articles" : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}

          {mode === "all" && knownSources.length > 1 && (
            <span className="flex items-center gap-1.5 ml-auto">
              <IFilter size={14} className="text-muted"/>
              <select className="input input-sm max-w-[200px]" value={source} onChange={e => setSource(e.target.value)}>
                <option value="">All sources</option>
                {knownSources.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </span>
          )}
        </div>
        <p className="text-xs text-muted">
          {mode === "all" && <>Recent articles ordered by ingestion time.</>}
          {mode === "keyword" && <>Exact SQL match on title and body.</>}
          {mode === "semantic" && <>Cosine match on sentence-transformer embeddings — finds meaning, not exact words.</>}
          {mode === "entity" && <>Match by entity name; clicking takes you to that entity profile.</>}
        </p>
      </div>

      {/* Body */}
      {mode === "all" ? (
        items.length === 0 && !busy ? (
          <Empty message="No articles ingested yet."/>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              {items.map(a => <ArticleCard key={a.id} a={a}/>)}
              {busy && items.length === 0 && Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-28"/>)}
            </div>
            <div className="flex justify-between">
              <button className="btn-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>← Previous</button>
              <button className="btn-secondary" disabled={items.length < 20} onClick={() => setOffset(offset + 20)}>Next →</button>
            </div>
          </>
        )
      ) : (
        <>
          {!busy && hits.length === 0 && q && <Empty message={`No results for “${q}”. Try a different mode.`}/>}
          <ul className="space-y-2">
            {hits.map(h => (
              <li key={`${h.kind}-${h.id}`} className="animate-slide-up">
                <Link href={h.kind === "article" ? `/articles/${h.id}` : `/entities/${h.id}`}
                      className="card card-hover p-4 block group">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    {h.kind === "article" ? <IArticle size={14}/> : <ITag size={14}/>}
                    <span className={h.kind === "article" ? "badge-slate" : "badge-blue"}>{h.kind}</span>
                    <span>· score {h.score.toFixed(2)}</span>
                  </div>
                  <div className="font-semibold text-ink mt-1 group-hover:text-accent transition">{h.title}</div>
                  {h.snippet && <p className="text-sm text-muted mt-1 leading-relaxed">{h.snippet}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ArticleCard({ a }: { a: Article }) {
  return (
    <Link href={`/articles/${a.id}`} className="card card-hover p-5 block animate-slide-up">
      <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
        {a.source && <span className="badge-slate">{a.source}</span>}
        {a.published_at && <span>· {new Date(a.published_at).toLocaleDateString()}</span>}
        {typeof a.sentiment === "number" && a.sentiment !== 0 && (
          <span className={a.sentiment > 0 ? "badge-green" : "badge-red"}>
            {a.sentiment > 0 ? "+" : ""}{(a.sentiment * 100).toFixed(0)}
          </span>
        )}
      </div>
      <div className="font-semibold text-ink mt-2 leading-snug">{a.title}</div>
      {a.summary && <p className="text-sm text-muted mt-1.5 line-clamp-3 leading-relaxed">{a.summary}</p>}
    </Link>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="card p-6 text-center">
      <IInfo size={22} className="text-muted mx-auto"/>
      <p className="text-sm text-muted mt-2">{message}</p>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <LibraryInner/>
    </Suspense>
  );
}
