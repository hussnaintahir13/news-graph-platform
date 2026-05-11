"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { SearchHit } from "@/types";
import { IArticle, IInfo, ISearch, ITag } from "@/components/Icons";

const MODES: { id: "keyword" | "semantic" | "entity"; label: string; help: string }[] = [
  { id: "keyword",  label: "Keyword",  help: "Exact match on article title/body." },
  { id: "semantic", label: "Semantic", help: "Cosine match on sentence-transformer embeddings — meaning, not words." },
  { id: "entity",   label: "Entity",   help: "Search by entity name (people, companies, countries)." },
];

function SearchInner() {
  const params = useSearchParams();
  const initialQ = params.get("q") || "";
  const [q, setQ] = useState(initialQ);
  const [mode, setMode] = useState<"keyword" | "semantic" | "entity">("keyword");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => { if (initialQ) run(initialQ); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function run(query?: string) {
    const v = (query ?? q).trim();
    if (!v) return;
    setQ(v); setBusy(true); setTouched(true);
    try { setHits(await api.search(v, mode)); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-baseline gap-2">
        <ISearch size={20} className="text-accent"/>
        <h1 className="text-2xl font-bold">Search</h1>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[260px]">
            <ISearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/>
            <input
              autoFocus
              className="input pl-9"
              placeholder="Search articles or entities…"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && run()}
            />
          </div>
          <button className="btn-primary" onClick={() => run()} disabled={busy || !q.trim()}>
            {busy ? "Searching…" : "Search"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={"px-3 py-1.5 rounded-full text-sm border transition " +
                (mode === m.id
                  ? "bg-accent text-white border-accent"
                  : "bg-white text-slate-700 border-slate-200 hover:border-accent")
              }
              title={m.help}
            >
              {m.label}
            </button>
          ))}
          <span className="text-xs text-muted ml-1">{MODES.find(m => m.id === mode)?.help}</span>
        </div>
      </div>

      {touched && !busy && hits.length === 0 && (
        <div className="card p-6 text-center">
          <IInfo size={22} className="text-muted mx-auto"/>
          <p className="text-sm text-muted mt-2">No results. Try a different query or switch search mode.</p>
        </div>
      )}

      <ul className="space-y-2">
        {hits.map(h => (
          <li key={`${h.kind}-${h.id}`} className="animate-slide-up">
            <Link
              href={h.kind === "article" ? `/articles/${h.id}` : `/entities/${h.id}`}
              className="card card-hover p-4 block group"
            >
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
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <SearchInner/>
    </Suspense>
  );
}
