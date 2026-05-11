"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, getAuth } from "@/lib/api";
import type { Article, Entity } from "@/types";

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [auth] = useState(() => getAuth());

  useEffect(() => {
    if (!auth) return;
    api.articles(0, 6).then(setArticles).catch(() => {});
    api.entities("", "", 8).then(setEntities).catch(() => {});
  }, [auth]);

  if (!auth) {
    return (
      <div className="grid md:grid-cols-2 gap-6 mt-10">
        <div>
          <h1 className="text-3xl font-bold">AI News Relationship Map</h1>
          <p className="mt-3 text-muted">
            Ingest news, extract people / companies / countries / events, and explore them as a live graph.
          </p>
          <ul className="mt-4 text-sm list-disc list-inside space-y-1 text-slate-700">
            <li>Continuous RSS / sitemap / URL ingestion</li>
            <li>spaCy NER + sentence co-occurrence relationships</li>
            <li>Sentence-transformer embeddings + semantic search</li>
            <li>Interactive React Flow graph with timeline drill-in</li>
            <li>Optional OpenAI-powered Q&A; deterministic fallback when offline</li>
          </ul>
          <Link href="/login" className="btn-primary mt-6">Sign in to start</Link>
        </div>
        <div className="card p-6">
          <h2 className="font-semibold">Default demo accounts</h2>
          <p className="text-sm text-muted mt-1">Created when you run <code className="bg-slate-100 px-1 rounded">python -m app.seeds</code>.</p>
          <ul className="mt-3 text-sm space-y-1">
            <li><code>admin@example.com</code> / <code>admin1234</code></li>
            <li><code>analyst@example.com</code> / <code>analyst1234</code></li>
            <li><code>user@example.com</code> / <code>user1234</code></li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Latest news</h1>
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Trending entities</h2>
          <Link href="/graph" className="btn-ghost text-sm">Open graph →</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {entities.map(e => (
            <Link key={e.id} href={`/entities/${e.id}`} className="badge bg-slate-100 hover:bg-slate-200 text-slate-700">
              {e.name} <span className="ml-1 text-muted">{e.mentions}×</span>
            </Link>
          ))}
          {entities.length === 0 && <p className="text-sm text-muted">No entities yet. Run an ingest from the Admin page.</p>}
        </div>
      </section>
      <section>
        <h2 className="font-semibold mb-2">Recent articles</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {articles.map(a => (
            <Link key={a.id} href={`/articles/${a.id}`} className="card p-4 hover:shadow-md transition">
              <div className="text-xs text-muted">{a.source}{a.published_at ? ` · ${new Date(a.published_at).toLocaleString()}` : ""}</div>
              <div className="font-medium mt-1">{a.title}</div>
              {a.summary && <p className="text-sm text-muted mt-1 line-clamp-3">{a.summary}</p>}
            </Link>
          ))}
          {articles.length === 0 && <p className="text-sm text-muted">No articles yet.</p>}
        </div>
      </section>
    </div>
  );
}
