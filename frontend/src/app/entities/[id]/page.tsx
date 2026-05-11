"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, getAuth } from "@/lib/api";
import type { EntityDetail } from "@/types";

export default function EntityPage() {
  const { id } = useParams() as { id: string };
  const [ent, setEnt] = useState<EntityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [auth] = useState(() => getAuth());

  useEffect(() => {
    api.entity(id).then(setEnt).catch(e => setError((e as Error).message));
  }, [id]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!ent) return <p className="text-muted">Loading…</p>;

  const canWatch = auth && (auth.user.role === "admin" || auth.user.role === "analyst");

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="text-xs text-muted">{ent.type} · mentioned {ent.mentions}×</div>
          <h1 className="text-2xl font-bold">{ent.name}</h1>
          {ent.description && <p className="text-sm text-slate-700 max-w-2xl mt-1">{ent.description}</p>}
        </div>
        <div className="flex gap-2">
          <Link className="btn-ghost" href={`/graph?entity=${ent.id}`}>Open in graph →</Link>
          {canWatch && (
            <button className="btn-primary" disabled={adding} onClick={async () => {
              setAdding(true);
              try { await api.addWatchlist(ent.id); alert("Added to watchlist"); }
              catch (e) { alert((e as Error).message); }
              finally { setAdding(false); }
            }}>
              {adding ? "Adding…" : "Watch"}
            </button>
          )}
        </div>
      </header>

      <section>
        <h2 className="font-semibold mb-2">Top relationships</h2>
        <div className="card divide-y">
          {ent.relationships.length === 0 && <p className="p-4 text-sm text-muted">None recorded yet.</p>}
          {ent.relationships.slice(0, 25).map(r => {
            const otherId = r.source_entity === ent.id ? r.target_entity : r.source_entity;
            const otherName = r.source_entity === ent.id ? r.target_name : r.source_name;
            return (
              <Link key={r.id} href={`/entities/${otherId}`} className="flex items-center justify-between p-3 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="badge bg-slate-100 text-slate-700">{r.relation_type}</span>
                  <span className="text-sm font-medium">{otherName || otherId}</span>
                </div>
                <span className="text-xs text-muted">conf {r.confidence.toFixed(2)} · weight {r.weight.toFixed(0)}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Timeline</h2>
        <ol className="space-y-1 text-sm border-l-2 border-slate-200 pl-4">
          {ent.timeline.map(t => (
            <li key={t.article_id}>
              <span className="text-muted">{new Date(t.date).toLocaleDateString()}</span> · <Link className="underline" href={`/articles/${t.article_id}`}>{t.title}</Link>
            </li>
          ))}
          {ent.timeline.length === 0 && <p className="text-muted">No events.</p>}
        </ol>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Articles</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {ent.articles.map(a => (
            <Link key={a.id} href={`/articles/${a.id}`} className="card p-3 hover:shadow-md transition">
              <div className="text-xs text-muted">{a.source}</div>
              <div className="font-medium">{a.title}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
