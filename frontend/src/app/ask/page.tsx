"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import type { AskResponse } from "@/types";

export default function AskPage() {
  const [q, setQ] = useState("");
  const [resp, setResp] = useState<AskResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    if (!q.trim()) return;
    setBusy(true); setError(null);
    try { setResp(await api.ask(q)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ask the news graph</h1>
      <p className="text-sm text-muted">
        Backed by OpenAI when <code>OPENAI_API_KEY</code> is set on the server. Otherwise uses a deterministic extractive answer
        derived from indexed articles.
      </p>
      <div className="flex flex-wrap gap-2">
        <input className="input max-w-xl" placeholder="e.g. How is Nvidia connected to OpenAI?" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()} />
        <button className="btn-primary" onClick={ask} disabled={busy}>{busy ? "Thinking…" : "Ask"}</button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {resp && (
        <div className="space-y-4">
          <div className="card p-4 whitespace-pre-wrap">{resp.answer}</div>
          {resp.sources.length > 0 && (
            <section>
              <h2 className="font-semibold mb-2">Sources</h2>
              <ul className="space-y-1 text-sm">
                {resp.sources.map(s => (
                  <li key={s.id}>
                    <Link className="underline" href={`/articles/${s.id}`}>{s.title}</Link>
                    {s.source && <span className="text-muted"> · {s.source}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {resp.entities.length > 0 && (
            <section>
              <h2 className="font-semibold mb-2">Related entities</h2>
              <div className="flex flex-wrap gap-2">
                {resp.entities.map(e => (
                  <Link key={e.id} href={`/entities/${e.id}`} className="badge bg-slate-100 hover:bg-slate-200 text-slate-700">
                    {e.name} <span className="ml-1 text-muted">{e.type}</span>
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
