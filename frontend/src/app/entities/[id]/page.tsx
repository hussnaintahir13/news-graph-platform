"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, getAuth } from "@/lib/api";
import type { EntityDetail } from "@/types";
import { IBell, IClock, IExternal, IGraph, IInfo, ITag } from "@/components/Icons";

const TYPE_COLOR: Record<string, string> = {
  Person: "#3B82F6", Company: "#10B981", Organization: "#10B981",
  Country: "#F59E0B", Event: "#EF4444", Product: "#8B5CF6",
  Technology: "#8B5CF6", Narrative: "#64748B",
};

export default function EntityPage() {
  const { id } = useParams() as { id: string };
  const [ent, setEnt] = useState<EntityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [watched, setWatched] = useState(false);
  const [auth] = useState(() => getAuth());

  useEffect(() => { api.entity(id).then(setEnt).catch(e => setError((e as Error).message)); }, [id]);

  if (error) return <div className="card p-6 text-center text-bad text-sm">{error}</div>;
  if (!ent) return (
    <div className="space-y-3 animate-fade-in">
      <div className="skeleton h-8 w-1/2"/>
      <div className="skeleton h-4 w-3/4"/>
      <div className="grid md:grid-cols-2 gap-3 mt-4">
        <div className="skeleton h-40"/><div className="skeleton h-40"/>
      </div>
    </div>
  );

  const canWatch = auth && (auth.user.role === "admin" || auth.user.role === "analyst");
  const color = TYPE_COLOR[ent.type] || "#475569";

  return (
    <div className="space-y-7 animate-fade-in">
      {/* Hero */}
      <header className="card p-6 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full opacity-30"
             style={{ background: `radial-gradient(circle, ${color} 0%, transparent 60%)` }}/>
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border" style={{ borderColor: color, color }}>
                <span className="w-2 h-2 rounded-full" style={{ background: color }}/>
                {ent.type}
              </span>
              <span>· mentioned {ent.mentions}×</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mt-1">{ent.name}</h1>
            {ent.description && <p className="text-sm text-slate-700 max-w-2xl mt-2 leading-relaxed">{ent.description}</p>}
          </div>
          <div className="flex gap-2">
            <Link className="btn-secondary" href={`/graph?entity=${ent.id}`}>
              <IGraph size={14}/> Open in graph
            </Link>
            {canWatch && (
              <button
                className={watched ? "btn-secondary" : "btn-primary"}
                disabled={adding}
                onClick={async () => {
                  setAdding(true);
                  try { await api.addWatchlist(ent.id); setWatched(true); }
                  catch (e) { alert((e as Error).message); }
                  finally { setAdding(false); }
                }}
              >
                <IBell size={14}/> {watched ? "Watching" : adding ? "Adding…" : "Watch"}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Top relationships */}
      <section>
        <div className="section-title mb-2 flex items-center gap-2"><ITag size={14}/> Top relationships</div>
        <div className="card divide-y divide-slate-100">
          {ent.relationships.length === 0 && (
            <div className="p-5 text-center text-sm text-muted flex items-center gap-2 justify-center">
              <IInfo size={16}/> None recorded yet.
            </div>
          )}
          {ent.relationships.slice(0, 25).map(r => {
            const otherId = r.source_entity === ent.id ? r.target_entity : r.source_entity;
            const otherName = r.source_entity === ent.id ? r.target_name : r.source_name;
            return (
              <Link key={r.id} href={`/entities/${otherId}`} className="flex items-center justify-between p-3 hover:bg-slate-50/60 group">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="badge-blue">{r.relation_type.toLowerCase().replace("_", " ")}</span>
                  <span className="font-medium truncate group-hover:text-accent transition">{otherName || otherId}</span>
                </div>
                <span className="text-xs text-muted shrink-0">conf {r.confidence.toFixed(2)} · weight {r.weight.toFixed(0)}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Timeline */}
      <section>
        <div className="section-title mb-2 flex items-center gap-2"><IClock size={14}/> Timeline</div>
        <ol className="card divide-y divide-slate-100">
          {ent.timeline.length === 0 && <p className="p-4 text-sm text-muted text-center">No events.</p>}
          {ent.timeline.map(t => (
            <li key={t.article_id} className="p-3 flex items-baseline gap-3 hover:bg-slate-50/60">
              <span className="text-xs text-muted w-24 shrink-0">{new Date(t.date).toLocaleDateString()}</span>
              <Link className="text-sm font-medium hover:text-accent transition flex-1" href={`/articles/${t.article_id}`}>
                {t.title}
              </Link>
              <IExternal size={12} className="text-muted shrink-0"/>
            </li>
          ))}
        </ol>
      </section>

      {/* Articles */}
      <section>
        <div className="section-title mb-2">Mentioned in</div>
        <div className="grid md:grid-cols-2 gap-3">
          {ent.articles.map(a => (
            <Link key={a.id} href={`/articles/${a.id}`} className="card card-hover p-4 block">
              <div className="text-xs text-muted">{a.source}</div>
              <div className="font-medium mt-1 line-clamp-2">{a.title}</div>
            </Link>
          ))}
          {ent.articles.length === 0 && <p className="text-sm text-muted col-span-2">No articles indexed yet.</p>}
        </div>
      </section>
    </div>
  );
}
