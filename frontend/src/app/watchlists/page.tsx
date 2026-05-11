"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Alert, Watchlist } from "@/types";
import { IBell, IClock, IInfo } from "@/components/Icons";

export default function WatchlistsPage() {
  const [watches, setWatches] = useState<Watchlist[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setWatches(await api.watchlists());
      setAlerts(await api.alerts());
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-7 animate-fade-in">
      <div className="flex items-baseline gap-2">
        <IBell size={20} className="text-accent"/>
        <h1 className="text-2xl font-bold">Watchlists & alerts</h1>
      </div>

      {error && <div className="card p-3 border-l-4 border-l-bad text-sm text-bad flex items-center gap-2"><IInfo size={16}/> {error}</div>}

      <section>
        <div className="section-title mb-2">Watched entities</div>
        <p className="text-sm text-muted mb-2">
          Add entities by clicking <b>Watch</b> on any entity page. The next ingest pass that mentions them creates an alert below.
        </p>
        {loading && <div className="skeleton h-28"/>}
        {!loading && watches.length === 0 && (
          <div className="card p-6 text-center">
            <IInfo size={22} className="text-muted mx-auto"/>
            <p className="text-sm text-muted mt-2">No entities watched yet. Find one on <Link className="link" href="/explore">Explore</Link>.</p>
          </div>
        )}
        <ul className="grid md:grid-cols-2 gap-3">
          {watches.map(w => (
            <Link key={w.id} href={`/entities/${w.entity_id}`} className="card card-hover p-4 flex items-center justify-between">
              <div className="font-medium">{w.entity_name || w.entity_id}</div>
              <span className="text-xs text-muted">{new Date(w.created_at).toLocaleDateString()}</span>
            </Link>
          ))}
        </ul>
      </section>

      <section>
        <div className="section-title mb-2 flex items-center gap-2"><IClock size={14}/> Recent alerts</div>
        <ul className="card divide-y divide-slate-100">
          {loading && <li className="p-4"><div className="skeleton h-12"/></li>}
          {!loading && alerts.length === 0 && (
            <li className="p-6 text-center text-sm text-muted">No alerts yet.</li>
          )}
          {alerts.map(a => (
            <li key={a.id} className="p-4 hover:bg-slate-50/60">
              <div className="text-xs text-muted">{new Date(a.created_at).toLocaleString()}</div>
              <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                <Link className="font-medium hover:text-accent transition" href={`/entities/${a.entity_id}`}>
                  {a.entity_name || a.entity_id}
                </Link>
                <span className="text-muted text-xs">→</span>
                <Link className="text-sm link" href={`/articles/${a.article_id}`}>
                  {a.article_title || a.article_id}
                </Link>
              </div>
              <div className="text-xs text-muted mt-0.5">{a.reason}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
