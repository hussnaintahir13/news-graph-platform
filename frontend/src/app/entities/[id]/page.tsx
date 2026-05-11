"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, getAuth } from "@/lib/api";
import type { EntityDetail } from "@/types";
import {
  IArticle, IBell, IClock, IConnect, IExternal, IGraph, IInfo, ISearch, ISpark, ITag, ITrend,
} from "@/components/Icons";

const TYPE_COLOR: Record<string, string> = {
  Person: "#3B82F6", Company: "#10B981", Organization: "#10B981",
  Country: "#F59E0B", Event: "#EF4444", Product: "#8B5CF6",
  Technology: "#8B5CF6", Narrative: "#64748B",
};

function relationVerb(t: string): string {
  return t.toLowerCase().replace(/_/g, " ");
}

function confidenceLabel(c: number): { label: string; color: string } {
  if (c >= 0.7) return { label: "Strong", color: "text-emerald-700 bg-emerald-50" };
  if (c >= 0.5) return { label: "Likely", color: "text-amber-700 bg-amber-50" };
  return { label: "Possible", color: "text-slate-600 bg-slate-50" };
}

function weightLabel(w: number): string {
  const n = Math.max(1, Math.round(w));
  return n === 1 ? "1 mention" : `${n} mentions`;
}

export default function EntityPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [ent, setEnt] = useState<EntityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [watched, setWatched] = useState(false);
  const [auth, setAuth] = useState<ReturnType<typeof getAuth>>(null);

  useEffect(() => { setAuth(getAuth()); }, []);
  useEffect(() => { api.entity(id).then(setEnt).catch(e => setError((e as Error).message)); }, [id]);

  const stats = useMemo(() => {
    if (!ent) return null;
    const dates = ent.timeline.map(t => new Date(t.date).getTime()).filter(t => !isNaN(t));
    const first = dates.length ? new Date(Math.min(...dates)) : null;
    const last  = dates.length ? new Date(Math.max(...dates)) : null;
    const distinct = new Set<string>();
    for (const r of ent.relationships) {
      distinct.add(r.source_entity === ent.id ? r.target_entity : r.source_entity);
    }
    return { mentions: ent.mentions, distinctRelations: distinct.size, articles: ent.articles.length, first, last };
  }, [ent]);

  if (error) return (
    <div className="card p-6 text-center">
      <IInfo size={22} className="text-bad mx-auto"/>
      <p className="text-sm text-bad mt-2">{error}</p>
      <button onClick={() => router.back()} className="btn-secondary mt-4 inline-flex">← Go back</button>
    </div>
  );
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
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <Link href="/graph" className="hover:text-accent transition">Graph</Link>
        <span>/</span>
        <span className="text-ink">{ent.name}</span>
      </div>

      {/* Hero */}
      <header className="card p-6 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full opacity-30"
             style={{ background: `radial-gradient(circle, ${color} 0%, transparent 60%)` }}/>
        <div className="relative">
          <div className="flex items-center gap-2 text-xs">
            <span className="badge-blue">Entity profile</span>
            <span className="text-muted">Everything we've extracted about this entity from the news index.</span>
          </div>
          <div className="flex items-baseline gap-3 mt-2 flex-wrap">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{ent.name}</h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-sm" style={{ borderColor: color, color }}>
              <span className="w-2 h-2 rounded-full" style={{ background: color }}/>
              {ent.type}
            </span>
          </div>
          {ent.description && <p className="text-sm text-slate-700 max-w-3xl mt-3 leading-relaxed">{ent.description}</p>}

          <div className="flex flex-wrap gap-2 mt-5">
            <Link className="btn-primary" href={`/graph?entity=${ent.id}`}>
              <IGraph size={14}/> Visualise the network
            </Link>
            {canWatch && (
              <button
                className="btn-secondary"
                disabled={adding}
                onClick={async () => {
                  setAdding(true);
                  try { await api.addWatchlist(ent.id); setWatched(true); }
                  catch (e) { alert((e as Error).message); }
                  finally { setAdding(false); }
                }}
              >
                <IBell size={14}/> {watched ? "Watching" : adding ? "Adding…" : "Watch for new mentions"}
              </button>
            )}
            <Link className="btn-secondary" href={`/connect?entities=${ent.id}`}>
              <IConnect size={14}/> Connect with another
            </Link>
            <Link className="btn-ghost" href={`/search?q=${encodeURIComponent(ent.name)}`}>
              <ISearch size={14}/> Search related articles
            </Link>
            <Link className="btn-ghost" href={`/ask?q=${encodeURIComponent("Tell me about " + ent.name)}`}>
              <ISpark size={14}/> Ask AI about this
            </Link>
          </div>
        </div>
      </header>

      {/* Stat tiles */}
      {stats && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={<ITag size={16}/>}     label="Mentions"        value={stats.mentions.toLocaleString()} help="Total times this entity appeared across all indexed articles." />
          <Stat icon={<IGraph size={16}/>}   label="Connections"     value={stats.distinctRelations}          help="Distinct other entities co-mentioned with this one." />
          <Stat icon={<IArticle size={16}/>} label="Source articles" value={stats.articles}                   help="Articles in the index that mention this entity." />
          <Stat icon={<IClock size={16}/>}   label="Last seen"       value={stats.last ? timeAgo(stats.last) : "—"} help={stats.first ? `First seen ${stats.first.toLocaleDateString()}` : "No dated mentions yet."} />
        </section>
      )}

      {/* Connections */}
      <section>
        <SectionHeader
          icon={<ITrend size={18} className="text-accent"/>}
          title="Connections"
          subtitle={`Other entities that appear alongside ${ent.name} in the same news articles. The verb describes the kind of relationship that surfaced.`}
        />
        <div className="card divide-y divide-slate-100">
          {ent.relationships.length === 0 && (
            <div className="p-6 text-center text-sm text-muted">
              <IInfo size={20} className="text-muted mx-auto mb-1"/>
              No connections yet — try ingesting more articles or check back later.
            </div>
          )}
          {ent.relationships.slice(0, 30).map(r => {
            const otherId = r.source_entity === ent.id ? r.target_entity : r.source_entity;
            const otherName = r.source_entity === ent.id ? r.target_name : r.source_name;
            const conf = confidenceLabel(r.confidence);
            return (
              <Link key={r.id} href={`/entities/${otherId}`} className="flex items-center gap-3 p-4 hover:bg-slate-50/60 group transition">
                <span className="text-muted text-sm shrink-0">→</span>
                <span className="font-medium truncate group-hover:text-accent transition flex-1 min-w-0">{otherName || otherId}</span>
                <span className="badge-blue text-xs shrink-0">{relationVerb(r.relation_type)}</span>
                <span className={"hidden md:inline-flex badge text-xs shrink-0 " + conf.color} title={`Raw confidence: ${r.confidence.toFixed(2)}`}>{conf.label}</span>
                <span className="hidden md:inline text-xs text-muted shrink-0" title={`Raw weight: ${r.weight.toFixed(1)}`}>{weightLabel(r.weight)}</span>
              </Link>
            );
          })}
        </div>
        {ent.relationships.length > 30 && (
          <p className="text-xs text-muted mt-2">Showing the top 30 of {ent.relationships.length} connections. Open in the graph for the full network.</p>
        )}
      </section>

      {/* Timeline */}
      <section>
        <SectionHeader
          icon={<IClock size={18} className="text-accent"/>}
          title="Mentions over time"
          subtitle={`When ${ent.name} was mentioned, newest first. Click any item to read the source.`}
        />
        <ol className="card divide-y divide-slate-100">
          {ent.timeline.length === 0 && <p className="p-6 text-sm text-muted text-center">No dated mentions yet.</p>}
          {ent.timeline.map(t => (
            <li key={t.article_id} className="flex items-baseline gap-4 p-4 hover:bg-slate-50/60 group transition">
              <span className="text-xs text-muted w-24 shrink-0 font-mono">{new Date(t.date).toLocaleDateString()}</span>
              <Link className="text-sm font-medium hover:text-accent transition flex-1 truncate" href={`/articles/${t.article_id}`}>
                {t.title}
              </Link>
              <IExternal size={12} className="text-muted opacity-0 group-hover:opacity-100 transition"/>
            </li>
          ))}
        </ol>
      </section>

      {/* Articles */}
      <section>
        <SectionHeader
          icon={<IArticle size={18} className="text-accent"/>}
          title="Source articles"
          subtitle="Every article in the index that mentions this entity. Open one to see the underlying text we extracted from."
        />
        <div className="grid md:grid-cols-2 gap-3">
          {ent.articles.map(a => (
            <Link key={a.id} href={`/articles/${a.id}`} className="card card-hover p-4 block">
              <div className="text-xs text-muted">{a.source}</div>
              <div className="font-medium mt-1 line-clamp-2">{a.title}</div>
              {a.summary && <p className="text-xs text-muted mt-1 line-clamp-2">{a.summary}</p>}
            </Link>
          ))}
          {ent.articles.length === 0 && <p className="text-sm text-muted col-span-2">No articles linked yet.</p>}
        </div>
      </section>

      {/* Explainer footer */}
      <details className="card p-4 cursor-pointer">
        <summary className="font-medium flex items-center gap-2 select-none"><IInfo size={16} className="text-muted"/> What am I looking at?</summary>
        <div className="text-sm text-slate-700 mt-3 leading-relaxed space-y-2">
          <p>This is the <b>entity profile</b>. Every time an article in the index mentions <b>{ent.name}</b>, we extract that mention, link it back here, and check whether other entities appear in the same sentence to build the connections you see above.</p>
          <p><b>Confidence</b> (Strong / Likely / Possible) reflects how confident the NLP pipeline is in the relationship verb. <b>Mentions</b> count how many times a pair appeared in the same article.</p>
          <p>To see the full network as a diagram click <i>Visualise the network</i>. To get an alert whenever a fresh article mentions this entity click <i>Watch</i>.</p>
        </div>
      </details>
    </div>
  );
}

function Stat({ icon, label, value, help }: { icon: React.ReactNode; label: string; value: React.ReactNode; help?: string }) {
  return (
    <div className="card p-4" title={help}>
      <div className="flex items-center gap-2 text-muted text-xs">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1 tracking-tight">{value}</div>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <p className="text-sm text-muted mt-1 max-w-3xl leading-relaxed">{subtitle}</p>
    </div>
  );
}

function timeAgo(date: Date): string {
  const sec = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);    if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);    if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);   if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
