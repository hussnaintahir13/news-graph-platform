"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Interest } from "@/types";
import { IClock, IHeart, IInfo, IPlus, IX } from "@/components/Icons";

const SUGGESTIONS = [
  "AI", "OpenAI", "Pakistan", "Iran", "Defense", "Climate", "Elections",
  "Stocks", "Crypto", "Inflation", "Healthcare", "Cybersecurity", "Space", "Semiconductors",
];

export default function InterestsPage() {
  const [items, setItems] = useState<Interest[]>([]);
  const [keyword, setKeyword] = useState("");
  const [priority, setPriority] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function load() {
    try { setItems(await api.interests()); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { load(); }, []);

  async function add(kw?: string) {
    const v = (kw ?? keyword).trim();
    if (!v) return;
    setBusy(true); setError(null); setInfo(null);
    try {
      await api.addInterest(v, priority);
      setKeyword("");
      setInfo("Added. The next 3-hour ingestion will pull news matching this keyword.");
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm("Remove this interest?")) return;
    try { await api.removeInterest(id); await load(); }
    catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <header>
        <div className="flex items-baseline gap-2">
          <IHeart size={22} className="text-accent"/>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My interests</h1>
        </div>
        <p className="text-sm text-muted mt-1 max-w-2xl leading-relaxed">
          Tell us 4-5 topics you care about. The platform fetches Google News headlines for each keyword
          every <b>3 hours</b> in addition to the standard sources, so articles relevant to you flow in first.
        </p>
      </header>

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input className="input flex-1 min-w-[220px]" placeholder="Add a keyword — e.g. Pakistan, AI, climate, missiles…"
                 value={keyword} onChange={e => setKeyword(e.target.value)}
                 onKeyDown={e => e.key === "Enter" && add()}/>
          <label className="text-xs text-muted">Priority</label>
          <select className="input input-sm max-w-[80px]" value={priority} onChange={e => setPriority(Number(e.target.value))}>
            {[1,2,3,5,8,10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button className="btn-primary" disabled={busy || !keyword.trim()} onClick={() => add()}>
            <IPlus size={14}/> Add
          </button>
        </div>

        <div>
          <div className="text-xs text-muted mb-1">Quick add:</div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map(s => (
              <button key={s}
                      onClick={() => add(s)}
                      disabled={busy}
                      className="px-2.5 py-1 rounded-full text-xs bg-slate-100 hover:bg-accent-light/60 hover:text-accent-dark transition">
                + {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="card p-3 border-l-4 border-l-bad text-sm text-bad flex items-center gap-2"><IInfo size={16}/> {error}</div>}
      {info && <div className="card p-3 border-l-4 border-l-good text-sm text-emerald-700 flex items-center gap-2"><IInfo size={16}/> {info}</div>}

      <section>
        <div className="section-title mb-2 flex items-center gap-2"><IHeart size={14}/> Your tracked keywords</div>
        {items.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted">
            No interests yet. Add a few above — the more specific, the better.
          </div>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {items.map(i => (
              <li key={i.id} className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50/60">
                <div>
                  <div className="font-medium">{i.keyword}</div>
                  <div className="text-xs text-muted flex items-center gap-2">
                    <span>Priority {i.priority}</span>
                    <span>·</span>
                    <IClock size={12}/>
                    <span>added {new Date(i.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button onClick={() => remove(i.id)} className="btn-ghost text-bad hover:bg-red-50" aria-label="Remove">
                  <IX size={14}/>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="card p-4 cursor-pointer">
        <summary className="font-medium flex items-center gap-2 select-none"><IInfo size={16} className="text-muted"/> How does priority crawling work?</summary>
        <div className="text-sm text-slate-700 mt-3 space-y-2 leading-relaxed">
          <p>Every 3 hours the backend wakes up and (a) pulls fresh items from each configured source on the admin page, and (b) hits a Google News search RSS feed for every unique interest keyword. Articles that match your interests get into the pipeline first.</p>
          <p>The <b>priority</b> number affects the order keywords are processed when many users have many interests — higher priority runs first.</p>
          <p>Tip: keep keywords specific. <i>"Healthcare"</i> is broader than <i>"NHS waiting lists"</i> — the latter returns sharper results.</p>
        </div>
      </details>
    </div>
  );
}
