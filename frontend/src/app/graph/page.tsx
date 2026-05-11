"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import GraphCanvas from "@/components/GraphCanvas";
import { api } from "@/lib/api";
import type { Entity } from "@/types";

function GraphPageInner() {
  const params = useSearchParams();
  const initialId = params.get("entity") || "";
  const [seedId, setSeedId] = useState(initialId);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Entity[]>([]);
  const [centrality, setCentrality] = useState<Entity[]>([]);

  useEffect(() => {
    api.centrality(15).then(rows => setCentrality(rows.map(r => ({
      id: r.entity_id, name: r.name, type: r.type, mentions: r.degree,
    }) as Entity))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!q) { setResults([]); return; }
    const h = setTimeout(() => { api.entities(q, "", 10).then(setResults).catch(() => {}); }, 200);
    return () => clearTimeout(h);
  }, [q]);

  useEffect(() => {
    if (!seedId && centrality.length > 0) setSeedId(centrality[0].id);
  }, [centrality, seedId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <input className="input max-w-xs" placeholder="Search entity…" value={q} onChange={e => setQ(e.target.value)} />
        {results.map(r => (
          <button key={r.id} className="badge bg-slate-100 hover:bg-slate-200" onClick={() => { setSeedId(r.id); setQ(""); setResults([]); }}>
            {r.name} <span className="ml-1 text-muted">{r.type}</span>
          </button>
        ))}
      </div>

      {!seedId ? (
        <div className="card p-6">
          <h2 className="font-semibold mb-2">Pick a seed entity</h2>
          <div className="flex flex-wrap gap-2">
            {centrality.map(c => (
              <button key={c.id} className="badge bg-slate-100 hover:bg-slate-200" onClick={() => setSeedId(c.id)}>
                {c.name} <span className="ml-1 text-muted">{c.type} · {c.mentions}</span>
              </button>
            ))}
            {centrality.length === 0 && <p className="text-sm text-muted">No entities yet. Trigger an ingest from the Admin page.</p>}
          </div>
        </div>
      ) : (
        <GraphCanvas entityId={seedId} />
      )}
    </div>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <GraphPageInner />
    </Suspense>
  );
}
