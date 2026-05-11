"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import EntityMultiSelect from "@/components/EntityMultiSelect";
import { api } from "@/lib/api";
import type { Entity, HypothesisResponse, PairAnalysis, PathInfo } from "@/types";
import { IArticle, IBeaker, IConnect, IGraph, IInfo, ISpark } from "@/components/Icons";

function ConnectInner() {
  const params = useSearchParams();
  const initialIds = (params.get("entities") || "").split(",").filter(Boolean);
  const [selected, setSelected] = useState<Entity[]>([]);
  const [result, setResult] = useState<HypothesisResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxHops, setMaxHops] = useState(3);

  // Hydrate selected entities from URL on first load.
  useEffect(() => {
    if (initialIds.length === 0) return;
    Promise.all(initialIds.map(id => api.entity(id).catch(() => null)))
      .then(rows => setSelected(rows.filter((r): r is Entity => r !== null)));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  async function analyse() {
    if (selected.length < 2) return;
    setBusy(true); setError(null);
    try {
      const res = await api.hypothesis(selected.map(s => s.id), maxHops, 3);
      setResult(res);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <header className="space-y-2">
        <div className="flex items-baseline gap-2">
          <IConnect size={22} className="text-accent"/>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Connect entities</h1>
        </div>
        <p className="text-muted text-sm max-w-3xl leading-relaxed">
          Pick two or more entities — people, companies, countries, even abstract concepts.
          The platform looks for direct relationships first, then follows multi-hop chains across the news index
          (e.g. <i>Pakistan ↔ Iran ↔ Missiles</i>) and writes a hypothesis grounded in the articles it found.
        </p>
      </header>

      {/* Picker */}
      <div className="card p-4 space-y-3">
        <EntityMultiSelect selected={selected} onChange={setSelected}/>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="text-xs text-muted">Max hops</label>
          <select className="input input-sm max-w-[80px]" value={maxHops} onChange={e => setMaxHops(Number(e.target.value))}>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
          <div className="ml-auto flex gap-2">
            {selected.length >= 2 && (
              <Link className="btn-secondary" href={`/graph?entities=${selected.map(s => s.id).join(",")}`}>
                <IGraph size={14}/> See in graph
              </Link>
            )}
            <button className="btn-primary" onClick={analyse} disabled={busy || selected.length < 2}>
              <IBeaker size={14}/> {busy ? "Analysing…" : "Analyse connection"}
            </button>
          </div>
        </div>
        {selected.length === 1 && (
          <p className="text-xs text-muted flex items-center gap-1.5"><IInfo size={12}/> Add at least one more entity to analyse a connection.</p>
        )}
      </div>

      {error && (
        <div className="card p-3 border-l-4 border-l-bad text-sm text-bad flex items-center gap-2">
          <IInfo size={16}/> {error}
        </div>
      )}

      {!result && !busy && selected.length < 2 && <EmptyHint/>}

      {result && (
        <div className="space-y-6 animate-slide-up">
          {/* Headline statement */}
          <div className="card p-5 border-l-4 border-l-accent bg-accent-light/30">
            <div className="flex items-center gap-2 mb-1">
              <ISpark size={16} className="text-accent"/>
              <div className="section-title">Hypothesis</div>
              <span className={"badge text-[10px] " + (result.ai_generated ? "badge-blue" : "badge-slate")}>
                {result.ai_generated ? "AI-polished" : "Deterministic"}
              </span>
            </div>
            <p className="leading-relaxed text-slate-800 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: bold(result.statement) }}/>
          </div>

          {/* Pair-by-pair breakdown */}
          <section className="space-y-3">
            <div className="section-title">Pairwise analysis</div>
            {result.pairs.map((p, i) => <PairCard key={i} pair={p}/>)}
          </section>

          {/* Supporting articles */}
          {result.supporting_articles.length > 0 && (
            <section>
              <div className="section-title mb-2 flex items-center gap-2"><IArticle size={14}/> Supporting articles</div>
              <p className="text-xs text-muted mb-2">News pieces that contributed to at least one of the paths above.</p>
              <div className="grid md:grid-cols-2 gap-3">
                {result.supporting_articles.map(a => (
                  <Link key={a.id} href={`/articles/${a.id}`} className="card card-hover p-4 block">
                    <div className="text-xs text-muted">{a.source}{a.published_at ? ` · ${new Date(a.published_at).toLocaleDateString()}` : ""}</div>
                    <div className="font-medium mt-1 line-clamp-2">{a.title}</div>
                    {a.summary && <p className="text-xs text-muted mt-1 line-clamp-2">{a.summary}</p>}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <details className="card p-4 cursor-pointer">
        <summary className="font-medium flex items-center gap-2 select-none"><IInfo size={16} className="text-muted"/> How is the hypothesis generated?</summary>
        <div className="text-sm text-slate-700 mt-3 space-y-2 leading-relaxed">
          <p>For every <b>pair</b> of selected entities the engine runs a breadth-first search over the relationship graph (up to <b>max hops</b>).
            The first paths returned are the shortest — direct edges if they exist, otherwise multi-hop chains via intermediate entities.</p>
          <p>The narrative is assembled deterministically from the paths and the articles that produced each edge.
            If an <code className="kbd">OPENAI_API_KEY</code> is configured on the backend, the deterministic narrative is polished into natural language using that evidence.</p>
          <p>If an entity you care about doesn't appear in the autocomplete, you can <b>add it as a new entity</b> — useful for concept words like “missiles” or “climate risk”. Future ingestion passes will start linking it automatically.</p>
        </div>
      </details>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="card p-6 text-center text-muted">
      <IConnect size={26} className="mx-auto"/>
      <p className="text-sm mt-2 max-w-md mx-auto">Start by typing the name of a person, company or country in the box above. Pick at least two — then hit <b>Analyse connection</b>.</p>
    </div>
  );
}

function PairCard({ pair }: { pair: PairAnalysis }) {
  const found = pair.direct || pair.indirect;
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold">{pair.from_name || pair.from_id}</span>
        <span className="text-muted">↔</span>
        <span className="font-semibold">{pair.to_name || pair.to_id}</span>
        <span className={"ml-auto badge " + (pair.direct ? "badge-green" : pair.indirect ? "badge-amber" : "badge-red")}>
          {pair.direct ? "Direct link" : pair.indirect ? "Indirect link" : "No link found"}
        </span>
      </div>
      {!found && <p className="text-sm text-muted mt-2">The engine could not connect these two within the chosen hop limit.</p>}
      {pair.paths.map((p, i) => <PathChain key={i} path={p}/>)}
    </div>
  );
}

function PathChain({ path }: { path: PathInfo }) {
  return (
    <div className="mt-3 p-3 bg-slate-50/60 rounded-lg">
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {path.chain_names.map((name, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-medium">{name}</span>
            {i < path.chain_names.length - 1 && (
              <span className="text-xs text-muted px-1">
                — {(path.steps[i]?.relation_type || "MENTIONED_WITH").toLowerCase().replace(/_/g, " ")} →
              </span>
            )}
          </span>
        ))}
      </div>
      <div className="text-xs text-muted mt-2">
        {path.length} hop{path.length === 1 ? "" : "s"}
        {" · "}
        evidence in {path.steps.filter(s => s.article_id).length} article{path.steps.filter(s => s.article_id).length === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function bold(text: string): string {
  // Convert **markdown bold** to <b> so we can ship a bit of formatting in the statement.
  return text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <ConnectInner/>
    </Suspense>
  );
}
