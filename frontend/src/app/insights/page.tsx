"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { AskResponse } from "@/types";
import { IArticle, IInfo, ISpark, ITag } from "@/components/Icons";

const SUGGESTIONS = [
  "How is Nvidia connected to OpenAI?",
  "Which countries appear most often in tech news?",
  "What recent acquisitions have been announced?",
  "Who are the main players in the AI investment space?",
];

const TYPE_BADGE: Record<string, string> = {
  Person: "badge-blue", Company: "badge-green", Organization: "badge-green",
  Country: "badge-amber", Event: "badge-red", Product: "badge-violet",
};

function InsightsInner() {
  const params = useSearchParams();
  const initialQ = params.get("q") || "";
  const [q, setQ] = useState(initialQ);
  const [resp, setResp] = useState<AskResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (initialQ) ask(initialQ); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function ask(question?: string) {
    const v = (question ?? q).trim();
    if (!v) return;
    setQ(v); setBusy(true); setError(null);
    try { setResp(await api.ask(v)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl mx-auto">
      <header>
        <div className="flex items-baseline gap-2">
          <ISpark size={22} className="text-accent"/>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Insights</h1>
        </div>
        <p className="text-sm text-muted mt-1">
          Ask plain-English questions about the indexed news. Answers always cite the supporting articles.
        </p>
      </header>

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <input className="input flex-1 min-w-[260px]" placeholder="e.g. How is Nvidia connected to OpenAI?"
                 value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()}/>
          <button className="btn-primary" onClick={() => ask()} disabled={busy || !q.trim()}>
            <ISpark size={14}/> {busy ? "Thinking…" : "Ask"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => ask(s)} className="px-3 py-1 rounded-full text-xs bg-slate-100 hover:bg-accent-light/60 hover:text-accent-dark transition">
              {s}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          Uses OpenAI when <code className="kbd">OPENAI_API_KEY</code> is set on the backend; otherwise falls back to a deterministic extractive answer.
        </p>
      </div>

      {error && (
        <div className="card p-3 border-l-4 border-l-bad text-sm text-bad flex items-center gap-2">
          <IInfo size={16}/> {error}
        </div>
      )}

      {resp && (
        <div className="space-y-4 animate-slide-up">
          <div className="card p-5 border-l-4 border-l-accent">
            <div className="section-title mb-1.5">Answer</div>
            <p className="whitespace-pre-wrap leading-relaxed text-slate-800">{resp.answer}</p>
          </div>

          {resp.sources.length > 0 && (
            <section>
              <div className="section-title mb-2 flex items-center gap-2"><IArticle size={14}/> Sources</div>
              <ul className="space-y-2">
                {resp.sources.map(s => (
                  <li key={s.id} className="card card-hover p-3">
                    <Link className="font-medium hover:text-accent transition" href={`/articles/${s.id}`}>{s.title}</Link>
                    {s.source && <div className="text-xs text-muted mt-0.5">{s.source}</div>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {resp.entities.length > 0 && (
            <section>
              <div className="section-title mb-2 flex items-center gap-2"><ITag size={14}/> Related entities</div>
              <div className="flex flex-wrap gap-2">
                {resp.entities.map(e => (
                  <Link key={e.id} href={`/entities/${e.id}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-sm hover:border-accent hover:shadow-sm transition">
                    <span className="font-medium">{e.name}</span>
                    <span className={TYPE_BADGE[e.type] || "badge-slate"}>{e.type}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <InsightsInner/>
    </Suspense>
  );
}
