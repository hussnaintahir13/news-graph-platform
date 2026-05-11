"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import type { SearchHit } from "@/types";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"keyword" | "semantic" | "entity">("keyword");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!q.trim()) return;
    setBusy(true);
    try { setHits(await api.search(q, mode)); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Search</h1>
      <div className="flex flex-wrap gap-2">
        <input
          className="input max-w-xl"
          placeholder="Search articles or entities…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && run()}
        />
        <select className="input max-w-[160px]" value={mode} onChange={e => setMode(e.target.value as typeof mode)}>
          <option value="keyword">Keyword</option>
          <option value="semantic">Semantic</option>
          <option value="entity">Entity</option>
        </select>
        <button className="btn-primary" onClick={run} disabled={busy}>{busy ? "Searching…" : "Search"}</button>
      </div>

      <ul className="space-y-2">
        {hits.map(h => (
          <li key={`${h.kind}-${h.id}`} className="card p-4">
            <Link href={h.kind === "article" ? `/articles/${h.id}` : `/entities/${h.id}`} className="block">
              <div className="flex items-center gap-2">
                <span className="badge bg-slate-100 text-slate-700">{h.kind}</span>
                <span className="text-xs text-muted">score {h.score.toFixed(2)}</span>
              </div>
              <div className="font-medium mt-1">{h.title}</div>
              {h.snippet && <p className="text-sm text-muted mt-1">{h.snippet}</p>}
            </Link>
          </li>
        ))}
        {hits.length === 0 && !busy && <p className="text-muted text-sm">No results yet.</p>}
      </ul>
    </div>
  );
}
