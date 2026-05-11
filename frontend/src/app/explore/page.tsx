"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import GraphCanvas from "@/components/GraphCanvas";
import type { GraphCanvasState } from "@/components/GraphCanvas";
import EntityAutocomplete from "@/components/EntityAutocomplete";
import EntityMultiSelect from "@/components/EntityMultiSelect";
import InsightsPanel from "@/components/InsightsPanel";
import { api } from "@/lib/api";
import type { Entity, HypothesisResponse, PairAnalysis, PathInfo } from "@/types";
import {
  IArticle, IBeaker, IConnect, IExplore, IGraph, IInfo, ISpark, ITrend,
} from "@/components/Icons";

type Mode = "single" | "multi";

function ExploreInner() {
  const params = useSearchParams();
  const router = useRouter();
  const urlMode = (params.get("mode") as Mode) || "single";
  const initialSingle = params.get("entity") || "";
  const initialMulti = (params.get("entities") || "").split(",").filter(Boolean);

  const [mode, setMode] = useState<Mode>(urlMode);
  const [seed, setSeed] = useState<Entity | null>(null);
  const [multi, setMulti] = useState<Entity[]>([]);
  const [hypothesis, setHypothesis] = useState<HypothesisResponse | null>(null);
  const [trending, setTrending] = useState<Entity[]>([]);
  const [busy, setBusy] = useState(false);
  const [maxHops, setMaxHops] = useState(3);
  const [graphView, setGraphView] = useState<GraphCanvasState | null>(null);

  useEffect(() => {
    api.centrality(15).then(rows => {
      setTrending(rows.map(r => ({ id: r.entity_id, name: r.name, type: r.type, mentions: r.degree }) as Entity));
    }).catch(() => {});
  }, []);

  // Hydrate seed in single mode from URL.
  useEffect(() => {
    if (mode === "single" && initialSingle && !seed) {
      api.entity(initialSingle).then(setSeed).catch(() => {});
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [mode, initialSingle]);

  // Hydrate multi from URL.
  useEffect(() => {
    if (mode === "multi" && initialMulti.length && multi.length === 0) {
      Promise.all(initialMulti.map(id => api.entity(id).catch(() => null)))
        .then(rows => setMulti(rows.filter((r): r is Entity => r !== null)));
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [mode]);

  function switchMode(next: Mode) {
    setMode(next); setHypothesis(null);
    const params = new URLSearchParams();
    params.set("mode", next);
    if (next === "single" && seed) params.set("entity", seed.id);
    if (next === "multi" && multi.length) params.set("entities", multi.map(m => m.id).join(","));
    router.replace(`/explore?${params.toString()}`);
  }

  function pickSeed(e: Entity) {
    setSeed(e);
    router.replace(`/explore?mode=single&entity=${e.id}`);
  }

  async function analyse() {
    if (multi.length < 2) return;
    setBusy(true);
    try { setHypothesis(await api.hypothesis(multi.map(m => m.id), maxHops, 3)); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <header>
        <div className="flex items-baseline gap-2">
          <IExplore size={22} className="text-accent"/>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Explore</h1>
        </div>
        <p className="text-sm text-muted mt-1 max-w-3xl">
          Pick a single seed to see what it's connected to, or combine two or more entities to discover paths between them.
          Click any node in the graph to drill into that entity's profile.
        </p>
      </header>

      {/* Mode toggle + controls */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg text-sm">
            <button onClick={() => switchMode("single")}
                    className={"px-3 py-1.5 rounded-md flex items-center gap-1.5 transition " + (mode === "single" ? "bg-white shadow-sm font-semibold text-ink" : "text-muted hover:text-ink")}>
              <IGraph size={14}/> Single seed
            </button>
            <button onClick={() => switchMode("multi")}
                    className={"px-3 py-1.5 rounded-md flex items-center gap-1.5 transition " + (mode === "multi" ? "bg-white shadow-sm font-semibold text-ink" : "text-muted hover:text-ink")}>
              <IConnect size={14}/> Connect entities
            </button>
          </div>
        </div>

        {mode === "single" ? (
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1">
              <EntityAutocomplete autoFocus onSelect={pickSeed}/>
            </div>
            {seed && (
              <div className="flex items-center gap-2 text-sm">
                <span className="badge-blue">Seed</span>
                <span className="font-medium">{seed.name}</span>
                <span className="badge-slate">{seed.type}</span>
                <button className="btn-ghost" onClick={() => { setSeed(null); router.replace("/explore?mode=single"); }}>Clear</button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <EntityMultiSelect selected={multi} onChange={setMulti}/>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="text-xs text-muted">Max hops</label>
              <select className="input input-sm max-w-[80px]" value={maxHops} onChange={e => setMaxHops(Number(e.target.value))}>
                <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
              </select>
              <button className="btn-primary ml-auto" onClick={analyse} disabled={busy || multi.length < 2}>
                <IBeaker size={14}/> {busy ? "Analysing…" : "Analyse connection"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      {mode === "single" ? (
        seed ? (
          <div className="space-y-5">
            <GraphCanvas entityId={seed.id} entityName={seed.name} onUpdate={setGraphView}/>
            <InsightsPanel entityId={seed.id} view={graphView}/>
          </div>
        ) : (
          <TrendingPicker trending={trending} onPick={pickSeed}/>
        )
      ) : (
        <MultiBody multi={multi} hypothesis={hypothesis} busy={busy}/>
      )}
    </div>
  );
}

function TrendingPicker({ trending, onPick }: { trending: Entity[]; onPick: (e: Entity) => void }) {
  const top3 = trending.slice(0, 3);
  const rest = trending.slice(3);
  if (trending.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-muted">
        <ITrend size={22} className="text-muted mx-auto"/>
        <p className="mt-2">No entities yet. Trigger an ingest from the <Link className="link" href="/admin">Admin</Link> page or wait for the next scheduled refresh.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {/* Top-3 hero grid */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ITrend size={16} className="text-accent"/>
          <h2 className="font-semibold">Most discussed right now</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {top3.map((c, i) => <HeroTopicCard key={c.id} entity={c} rank={i + 1} onPick={onPick}/>)}
        </div>
      </div>

      {/* Chip list for the remainder */}
      {rest.length > 0 && (
        <div className="card p-4">
          <div className="section-title mb-2">More trending</div>
          <div className="flex flex-wrap gap-2">
            {rest.map(c => (
              <button key={c.id} className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-sm hover:border-accent hover:shadow-sm transition" onClick={() => onPick(c)}>
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 text-xs text-muted">{c.type} · {c.mentions}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const HERO_GRADIENT = [
  "linear-gradient(135deg, #3B82F6, #8B5CF6)",
  "linear-gradient(135deg, #10B981, #06B6D4)",
  "linear-gradient(135deg, #F59E0B, #EF4444)",
];

function HeroTopicCard({ entity, rank, onPick }: { entity: Entity; rank: number; onPick: (e: Entity) => void }) {
  return (
    <button
      onClick={() => onPick(entity)}
      className="card card-hover p-5 text-left relative overflow-hidden group"
    >
      <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full opacity-30 group-hover:opacity-50 transition" style={{ background: HERO_GRADIENT[(rank - 1) % HERO_GRADIENT.length] }}/>
      <div className="relative">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">#{rank}</span>
          <span className="badge-slate text-[10px]">{entity.type}</span>
        </div>
        <div className="font-bold text-lg mt-1 leading-snug">{entity.name}</div>
        <div className="text-xs text-muted mt-1">{entity.mentions} mention{entity.mentions === 1 ? "" : "s"}</div>
        <div className="mt-4 inline-flex items-center gap-1 text-sm text-accent font-medium group-hover:gap-2 transition-all">
          Explore →
        </div>
      </div>
    </button>
  );
}

function MultiBody({ multi, hypothesis, busy }: { multi: Entity[]; hypothesis: HypothesisResponse | null; busy: boolean }) {
  if (multi.length === 0) {
    return (
      <div className="card p-6 text-center text-muted">
        <IConnect size={26} className="mx-auto"/>
        <p className="text-sm mt-2 max-w-md mx-auto">Start by typing the name of a person, company or country in the box above. Pick at least two — then hit <b>Analyse connection</b>.</p>
      </div>
    );
  }
  if (!hypothesis) {
    return (
      <div className="card p-6 text-center text-muted">
        <p className="text-sm">{multi.length === 1 ? "Add at least one more entity." : "Hit Analyse connection to see how these entities relate."}</p>
      </div>
    );
  }
  return (
    <div className="space-y-5 animate-slide-up">
      <div className="card p-5 border-l-4 border-l-accent bg-accent-light/30">
        <div className="flex items-center gap-2 mb-1">
          <ISpark size={16} className="text-accent"/>
          <div className="section-title">Hypothesis</div>
          <span className={"badge text-[10px] " + (hypothesis.ai_generated ? "badge-blue" : "badge-slate")}>
            {hypothesis.ai_generated ? "AI-polished" : "Deterministic"}
          </span>
        </div>
        <p className="leading-relaxed text-slate-800" dangerouslySetInnerHTML={{ __html: bold(hypothesis.statement) }}/>
      </div>

      <section className="space-y-3">
        <div className="section-title">Pairwise analysis</div>
        {hypothesis.pairs.map((p, i) => <PairCard key={i} pair={p}/>)}
      </section>

      {hypothesis.supporting_articles.length > 0 && (
        <section>
          <div className="section-title mb-2 flex items-center gap-2"><IArticle size={14}/> Supporting articles</div>
          <div className="grid md:grid-cols-2 gap-3">
            {hypothesis.supporting_articles.map(a => (
              <Link key={a.id} href={`/articles/${a.id}`} className="card card-hover p-4 block">
                <div className="text-xs text-muted">{a.source}{a.published_at ? ` · ${new Date(a.published_at).toLocaleDateString()}` : ""}</div>
                <div className="font-medium mt-1 line-clamp-2">{a.title}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PairCard({ pair }: { pair: PairAnalysis }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <span className="font-semibold">{pair.from_name || pair.from_id}</span>
        <span className="text-muted">↔</span>
        <span className="font-semibold">{pair.to_name || pair.to_id}</span>
        <span className={"ml-auto badge " + (pair.direct ? "badge-green" : pair.indirect ? "badge-amber" : "badge-red")}>
          {pair.direct ? "Direct link" : pair.indirect ? "Indirect link" : "No link found"}
        </span>
      </div>
      {pair.paths.map((p, i) => <PathChain key={i} path={p}/>)}
    </div>
  );
}

function PathChain({ path }: { path: PathInfo }) {
  return (
    <div className="mt-3 p-3 bg-slate-50/60 rounded-lg overflow-x-auto">
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {path.chain_names.map((name, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-medium whitespace-nowrap">{name}</span>
            {i < path.chain_names.length - 1 && (
              <span className="text-xs text-muted px-1 whitespace-nowrap">
                — {(path.steps[i]?.relation_type || "MENTIONED_WITH").toLowerCase().replace(/_/g, " ")} →
              </span>
            )}
          </span>
        ))}
      </div>
      <div className="text-xs text-muted mt-2">{path.length} hop{path.length === 1 ? "" : "s"}</div>
    </div>
  );
}

function bold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <ExploreInner/>
    </Suspense>
  );
}
