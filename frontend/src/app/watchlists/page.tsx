"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Alert, Watchlist } from "@/types";

export default function WatchlistsPage() {
  const [watches, setWatches] = useState<Watchlist[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setWatches(await api.watchlists());
      setAlerts(await api.alerts());
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Watchlists & alerts</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <section>
        <h2 className="font-semibold mb-2">Watched entities</h2>
        <p className="text-sm text-muted">Add entities to your watchlist by clicking <em>Watch</em> on any entity page.</p>
        <ul className="card divide-y mt-2">
          {watches.map(w => (
            <li key={w.id} className="p-3 flex justify-between">
              <Link className="font-medium hover:underline" href={`/entities/${w.entity_id}`}>{w.entity_name || w.entity_id}</Link>
              <span className="text-xs text-muted">{new Date(w.created_at).toLocaleDateString()}</span>
            </li>
          ))}
          {watches.length === 0 && <p className="p-3 text-sm text-muted">No entities watched yet.</p>}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Recent alerts</h2>
        <ul className="card divide-y">
          {alerts.map(a => (
            <li key={a.id} className="p-3 text-sm">
              <div className="text-xs text-muted">{new Date(a.created_at).toLocaleString()}</div>
              <div className="font-medium">{a.entity_name || a.entity_id}</div>
              <Link className="text-accent underline" href={`/articles/${a.article_id}`}>{a.article_title || a.article_id}</Link>
              <div className="text-muted text-xs">{a.reason}</div>
            </li>
          ))}
          {alerts.length === 0 && <p className="p-3 text-sm text-muted">No alerts yet.</p>}
        </ul>
      </section>
    </div>
  );
}
