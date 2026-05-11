"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Source } from "@/types";

export default function AdminPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<"rss" | "sitemap" | "url">("rss");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function load() {
    try { setSources(await api.sources()); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.addSource({ name, url, kind });
      setName(""); setUrl("");
      await load();
    } catch (err) { setError((err as Error).message); }
  }

  async function runNow() {
    setInfo(null);
    try {
      await api.runIngest();
      setInfo("Ingest queued. New articles will appear once processing completes.");
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin — sources</h1>
      <p className="text-sm text-muted">Admins only. Add RSS feeds, sitemaps, or one-off URLs; trigger an ingest pass on demand.</p>

      <form onSubmit={add} className="card p-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-muted">Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs text-muted">Kind</label>
          <select className="input" value={kind} onChange={e => setKind(e.target.value as typeof kind)}>
            <option value="rss">RSS</option>
            <option value="sitemap">Sitemap</option>
            <option value="url">URL</option>
          </select>
        </div>
        <div className="flex-1 min-w-[260px]">
          <label className="block text-xs text-muted">URL</label>
          <input className="input" value={url} onChange={e => setUrl(e.target.value)} required />
        </div>
        <button className="btn-primary">Add</button>
        <button type="button" className="btn-ghost" onClick={runNow}>Run ingest now</button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {info && <p className="text-sm text-green-700">{info}</p>}

      <ul className="card divide-y">
        {sources.map(s => (
          <li key={s.id} className="p-3 flex justify-between items-center">
            <div>
              <div className="font-medium">{s.name} <span className="badge bg-slate-100 text-slate-700 ml-2">{s.kind}</span></div>
              <a className="text-xs text-muted underline" href={s.url} target="_blank" rel="noreferrer">{s.url}</a>
            </div>
            <div className="text-xs text-muted">{s.last_run_at ? `Last run: ${new Date(s.last_run_at).toLocaleString()}` : "Never run"}</div>
          </li>
        ))}
        {sources.length === 0 && <p className="p-3 text-sm text-muted">No sources yet.</p>}
      </ul>
    </div>
  );
}
