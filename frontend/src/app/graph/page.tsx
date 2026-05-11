"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import GraphCanvas from "@/components/GraphCanvas";
import EntityAutocomplete from "@/components/EntityAutocomplete";
import { api } from "@/lib/api";
import type { Entity } from "@/types";
import { IGraph, IInfo, ITrend } from "@/components/Icons";

function GraphPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initialId = params.get("entity") || "";
  const [seed, setSeed] = useState<Entity | null>(null);
  const [trending, setTrending] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.centrality(18).then(rows => {
      setTrending(rows.map(r => ({ id: r.entity_id, name: r.name, type: r.type, mentions: r.degree }) as Entity));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!initialId || (seed && seed.id === initialId)) return;
    api.entity(initialId).then(setSeed).catch(() => {});
  }, [initialId, seed]);

  function pick(e: Entity) {
    setSeed(e);
    router.replace(`/graph?entity=${e.id}`);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-baseline gap-2">
        <IGraph size={20} className="text-accent"/>
        <h1 className="text-2xl font-bold">Entity graph</h1>
      </div>
      <p className="text-muted text-sm -mt-3">
        Search for a person, company or country — then explore who they're connected to, and how.
      </p>

      <div className="card p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1">
          <EntityAutocomplete autoFocus onSelect={pick}/>
        </div>
        {seed && (
          <div className="flex items-center gap-2 text-sm">
            <span className="badge-blue">Seed</span>
            <span className="font-medium">{seed.name}</span>
            <span className="badge-slate">{seed.type}</span>
            <button className="btn-ghost" onClick={() => { setSeed(null); router.replace("/graph"); }}>Clear</button>
          </div>
        )}
      </div>

      {!seed ? (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-3">
            <ITrend size={16} className="text-accent"/>
            <h2 className="font-semibold">Or pick a trending entity to start</h2>
          </div>
          {loading && (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ width: 110 + (i * 13) % 60, height: 32 }}/>)}
            </div>
          )}
          {!loading && trending.length === 0 && (
            <div className="text-sm text-muted flex items-center gap-2 mt-2">
              <IInfo size={16}/> No entities yet — trigger an ingest from the <a className="link" href="/admin">Admin</a> page.
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {trending.map(c => (
              <button key={c.id} className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-sm hover:border-accent hover:shadow-sm transition" onClick={() => pick(c)}>
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 text-xs text-muted">{c.type} · {c.mentions}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <GraphCanvas entityId={seed.id} entityName={seed.name}/>
      )}
    </div>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <GraphPageInner/>
    </Suspense>
  );
}
