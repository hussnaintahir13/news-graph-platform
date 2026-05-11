"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Source } from "@/types";
import { IExternal, IInfo, IPlus, ISettings } from "@/components/Icons";

const PRESETS: { name: string; url: string }[] = [
  { name: "BBC World",  url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "Guardian World",  url: "https://www.theguardian.com/world/rss" },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { name: "The Verge",  url: "https://www.theverge.com/rss/index.xml" },
  { name: "Hacker News",url: "https://hnrss.org/frontpage" },
  { name: "Dawn (PK)",  url: "https://www.dawn.com/feeds/home" },
];

export default function AdminPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<"rss" | "sitemap" | "url">("rss");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setSources(await api.sources()); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    try {
      await api.addSource({ name, url, kind });
      setName(""); setUrl("");
      setInfo("Source added.");
      await load();
    } catch (err) { setError((err as Error).message); }
  }

  async function runNow() {
    setError(null); setInfo(null);
    try {
      await api.runIngest();
      setInfo("Ingest queued in the background. Articles will appear within a few minutes.");
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-baseline gap-2">
        <ISettings size={20} className="text-accent"/>
        <h1 className="text-2xl font-bold">Admin — sources</h1>
      </div>
      <p className="text-sm text-muted -mt-3">
        Add RSS feeds, sitemaps or single article URLs. The scheduler picks them up every 30 minutes;
        click <b>Run ingest now</b> to trigger immediately.
      </p>

      <form onSubmit={add} className="card p-5 grid grid-cols-1 md:grid-cols-[200px_120px_1fr_auto_auto] gap-3 items-end">
        <div>
          <label className="block text-xs text-muted mb-1">Name</label>
          <input className="input" placeholder="e.g. BBC World" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Kind</label>
          <select className="input" value={kind} onChange={e => setKind(e.target.value as typeof kind)}>
            <option value="rss">RSS</option>
            <option value="sitemap">Sitemap</option>
            <option value="url">URL</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">URL</label>
          <input className="input" placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} required />
        </div>
        <button className="btn-primary"><IPlus size={14}/> Add</button>
        <button type="button" className="btn-secondary" onClick={runNow}>Run ingest now</button>
      </form>

      {/* Quick presets */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Quick add:</span>
        {PRESETS.map(p => (
          <button key={p.url}
                  className="px-3 py-1 rounded-full text-xs bg-slate-100 hover:bg-accent-light/60 hover:text-accent-dark transition"
                  onClick={() => { setName(p.name); setUrl(p.url); setKind("rss"); }}>
            {p.name}
          </button>
        ))}
      </div>

      {error && <div className="card p-3 border-l-4 border-l-bad text-sm text-bad flex items-center gap-2"><IInfo size={16}/> {error}</div>}
      {info && <div className="card p-3 border-l-4 border-l-good text-sm text-emerald-700 flex items-center gap-2"><IInfo size={16}/> {info}</div>}

      <div>
        <div className="section-title mb-2">Configured sources</div>
        {loading && <div className="skeleton h-24"/>}
        {!loading && sources.length === 0 && (
          <div className="card p-6 text-center text-sm text-muted">No sources yet — add one above.</div>
        )}
        <ul className="card divide-y divide-slate-100">
          {sources.map(s => (
            <li key={s.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60">
              <div className="min-w-0">
                <div className="font-medium flex items-center gap-2">
                  {s.name}
                  <span className="badge-slate uppercase text-[10px]">{s.kind}</span>
                  {s.enabled ? <span className="badge-green text-[10px]">enabled</span> : <span className="badge-red text-[10px]">disabled</span>}
                </div>
                <a className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent" target="_blank" rel="noreferrer" href={s.url}>
                  <IExternal size={11}/> {s.url}
                </a>
              </div>
              <div className="text-xs text-muted shrink-0">
                {s.last_run_at ? `Last run: ${new Date(s.last_run_at).toLocaleString()}` : "Never run"}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
