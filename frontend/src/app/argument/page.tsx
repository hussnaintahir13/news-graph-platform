"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import EntityAutocomplete from "@/components/EntityAutocomplete";
import { api, getAuth } from "@/lib/api";
import type { ArgumentPremise, ArgumentResponse, Entity } from "@/types";
import {
  IArticle, IInfo, IQuote, IScale, IShield, ITag, IX,
} from "@/components/Icons";

const BAND_COLOR: Record<string, string> = {
  "very-low": "text-slate-600 bg-slate-100",
  "low": "text-amber-700 bg-amber-50",
  "moderate": "text-amber-800 bg-amber-100",
  "high": "text-emerald-700 bg-emerald-50",
};

const TEMPLATE_BLURB: Record<string, string> = {
  facilitation: "Facilitation template — fires when subject has partnership/investment edges that lead to an outcome with harm-typed edges.",
  association:  "Association template — fires when the chain ends in attack/sue/regulate without partnership/investment context.",
  beneficiary:  "Beneficiary template — fires when investment + acquisition appear together in the chain.",
  collaboration:"Collaboration template — fires when the chain contains a partnership edge.",
  linkage:      "Linkage template — fallback for chains with cue-typed edges that don't match the patterns above.",
};

export default function ArgumentPage() {
  const [auth, setAuth] = useState<ReturnType<typeof getAuth>>(null);
  useEffect(() => { setAuth(getAuth()); }, []);

  const [subject, setSubject] = useState<Entity | null>(null);
  const [outcome, setOutcome] = useState<Entity | null>(null);
  const [theme, setTheme] = useState<Entity | null>(null);
  const [minConf, setMinConf] = useState(0.5);
  const [maxHops, setMaxHops] = useState(4);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ArgumentResponse | null>(null);

  const canRun =
    !!subject && !!outcome && subject.id !== outcome.id && accepted && !busy;

  async function run() {
    if (!canRun || !subject || !outcome) return;
    setBusy(true); setError(null); setResult(null);
    try {
      setResult(await api.buildArgument(subject.id, outcome.id, theme?.id, minConf, maxHops));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  // Authorisation gating in the UI; the API also gates.
  if (auth && !["admin", "analyst"].includes(auth.user.role)) {
    return (
      <div className="card p-6 max-w-2xl mx-auto text-center">
        <IShield size={28} className="mx-auto text-muted"/>
        <h2 className="font-semibold mt-2">Restricted</h2>
        <p className="text-sm text-muted mt-1">Argument construction is available to admin and analyst roles only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <header>
        <div className="flex items-baseline gap-2">
          <IScale size={22} className="text-accent"/>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Build argument <span className="badge-amber text-[10px] align-middle">beta</span></h1>
        </div>
        <p className="text-sm text-muted mt-1 max-w-2xl leading-relaxed">
          Construct a numbered, hedged claim from a chained sequence of news evidence — like a SQL join across people, deals and events.
          Every step shows the article quote it came from.
        </p>
      </header>

      {/* Persistent disclaimer banner */}
      <div className="rounded-xl2 border border-amber-200 bg-amber-50/70 p-4 flex items-start gap-3">
        <IShield size={20} className="text-amber-700 shrink-0 mt-0.5"/>
        <div className="text-sm leading-relaxed text-amber-900">
          <strong>This is an evidence-chain assembler, not investigative journalism.</strong> Output is generated automatically from public news
          mentions; co-occurrence does not establish causation, and the conclusions you see are
          <em> hedged possibilities</em> never facts. Do not publish, share, or screenshot generated arguments without independent verification.
          The chain is rejected automatically if any edge is mere co-mention (<code className="kbd">MENTIONED_WITH</code>) or falls below your
          confidence threshold.
        </div>
      </div>

      {/* Picker */}
      <section className="card p-4 space-y-4">
        <PickerRow label="Subject" hint="Who or what you are making a claim about." selected={subject} onSelect={setSubject} onClear={() => setSubject(null)}/>
        <PickerRow label="Outcome" hint="The event / entity at the end of the chain." selected={outcome} onSelect={setOutcome} onClear={() => setOutcome(null)}/>
        <PickerRow label="Theme (optional)" hint="An intermediate entity the chain must pass through (e.g. 'missiles')." selected={theme} onSelect={setTheme} onClear={() => setTheme(null)}/>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs text-muted mb-1">Minimum edge confidence: <b>{minConf.toFixed(2)}</b></label>
            <input type="range" min="0.4" max="0.85" step="0.05" value={minConf}
                   onChange={e => setMinConf(parseFloat(e.target.value))} className="w-full"/>
            <div className="text-[11px] text-muted">Higher = stricter; lower = noisier.</div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Max hops in the chain</label>
            <select className="input input-sm" value={maxHops} onChange={e => setMaxHops(Number(e.target.value))}>
              <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
            </select>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm cursor-pointer pt-2 border-t border-slate-100">
          <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1"/>
          <span>
            I understand this output is generated from public news context, is a hedged inference, may be incorrect, and I will not publish or share it without independent verification.
          </span>
        </label>

        <button className="btn-primary w-full justify-center" disabled={!canRun} onClick={run}>
          <IScale size={14}/> {busy ? "Building chain…" : "Build argument"}
        </button>
      </section>

      {error && <div className="card p-3 border-l-4 border-l-bad text-sm text-bad flex items-center gap-2"><IInfo size={16}/> {error}</div>}

      {result && (result.can_construct ? <ResultView r={result}/> : <DeclinedView r={result}/>)}
    </div>
  );
}

function PickerRow({ label, hint, selected, onSelect, onClear }:
  { label: string; hint: string; selected: Entity | null; onSelect: (e: Entity) => void; onClear: () => void }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <label className="text-xs font-semibold text-ink">{label}</label>
        <span className="text-[11px] text-muted">{hint}</span>
      </div>
      {selected ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-accent-light/30">
          <ITag size={14} className="text-accent-dark"/>
          <span className="font-medium">{selected.name}</span>
          <span className="badge-slate text-[10px]">{selected.type}</span>
          <button onClick={onClear} className="ml-auto btn-ghost p-1 rounded-md" aria-label={`Clear ${label}`}>
            <IX size={12}/>
          </button>
        </div>
      ) : (
        <EntityAutocomplete onSelect={onSelect}/>
      )}
    </div>
  );
}

function DeclinedView({ r }: { r: ArgumentResponse }) {
  return (
    <div className="card p-5 border-l-4 border-l-amber-400 bg-amber-50/40">
      <div className="flex items-center gap-2">
        <IShield size={18} className="text-amber-700"/>
        <h3 className="font-semibold">No argument constructed</h3>
      </div>
      <p className="text-sm mt-2 text-slate-700 leading-relaxed">{r.decline_reason}</p>
      <p className="text-xs text-muted mt-3">
        Tip: try a lower confidence threshold, a different theme, or ingest more sources from the Admin page so the relation extractor has more cue-typed edges to work with.
      </p>
    </div>
  );
}

function ResultView({ r }: { r: ArgumentResponse }) {
  return (
    <div className="space-y-5 animate-slide-up">
      {/* Chain badges */}
      <div className="card p-4">
        <div className="section-title mb-2">The chain</div>
        <div className="flex flex-wrap items-center gap-2">
          {r.chain_names.map((name, i) => (
            <span key={i} className="inline-flex items-center gap-2">
              <span className="px-3 py-1 rounded-md bg-white border border-slate-200 font-medium">{name}</span>
              {i < r.chain_names.length - 1 && (
                <span className="text-xs text-muted">→ {r.premises[i]?.relation_verb} →</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Numbered premises */}
      <section>
        <div className="section-title mb-2 flex items-center gap-2"><IQuote size={14}/> Premises</div>
        <ol className="space-y-3">
          {r.premises.map(p => <PremiseRow key={p.n} p={p}/>)}
        </ol>
      </section>

      {/* Conclusion */}
      <section className="card p-5 border-l-4 border-l-accent">
        <div className="flex items-center gap-2 mb-1.5">
          <IScale size={16} className="text-accent"/>
          <div className="section-title">Hedged conclusion</div>
          <span className={"badge text-[10px] " + (BAND_COLOR[r.confidence_band] || "badge-slate")}>
            confidence: {r.confidence_band}
          </span>
          <span className="badge-slate text-[10px]">{r.conclusion_template}</span>
        </div>
        <p className="text-slate-800 leading-relaxed">{r.conclusion}</p>
        <p className="text-xs text-muted mt-2 italic">
          {TEMPLATE_BLURB[r.conclusion_template] || "Generated from a fixed template."}
        </p>
      </section>

      {/* Supporting articles */}
      {r.supporting_articles.length > 0 && (
        <section>
          <div className="section-title mb-2 flex items-center gap-2"><IArticle size={14}/> All supporting articles</div>
          <div className="grid md:grid-cols-2 gap-3">
            {r.supporting_articles.map(a => (
              <Link key={a.id} href={`/articles/${a.id}`} className="card card-hover p-4 block">
                <div className="text-xs text-muted">{a.source}</div>
                <div className="font-medium mt-1 line-clamp-2">{a.title}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Footer disclaimer reinforced */}
      <p className="text-xs text-muted text-center italic px-4">
        This argument was assembled automatically by software. It is a hedged inference, not a verified fact. Always check the underlying quotes
        before relying on or sharing this content. © Syed Hussnain Tahir Sherazi.
      </p>
    </div>
  );
}

function PremiseRow({ p }: { p: ArgumentPremise }) {
  const confidence = p.confidence >= 0.7 ? "Strong" : p.confidence >= 0.55 ? "Likely" : "Weak";
  return (
    <li className="card p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="w-6 h-6 rounded-full bg-accent-light text-accent-dark text-xs font-bold flex items-center justify-center">{p.n}</span>
        <span className="font-medium">{p.source_name}</span>
        <span className="badge-blue">{p.relation_verb}</span>
        <span className="font-medium">{p.target_name}</span>
        <span className="ml-auto text-xs text-muted">confidence {p.confidence.toFixed(2)} · {confidence}</span>
      </div>
      {p.article_quote ? (
        <blockquote className="mt-3 pl-3 border-l-2 border-accent-light text-sm text-slate-700 italic leading-relaxed">
          “{p.article_quote}”
        </blockquote>
      ) : (
        <p className="mt-3 text-xs text-muted italic">No exact sentence found in the source article — this edge is supported by article-level context only.</p>
      )}
      {p.article_id && (
        <Link href={`/articles/${p.article_id}`} className="inline-flex items-center gap-1 mt-2 text-xs link">
          <IArticle size={11}/> {p.article_title || "Open source article"}
        </Link>
      )}
    </li>
  );
}
