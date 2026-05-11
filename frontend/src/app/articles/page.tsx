"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Article } from "@/types";
import { IArticle, IInfo } from "@/components/Icons";

const PAGE = 20;

export default function ArticlesPage() {
  const [items, setItems] = useState<Article[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.articles(offset, PAGE).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, [offset]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-baseline gap-2">
        <IArticle size={20} className="text-accent"/>
        <h1 className="text-2xl font-bold">Articles</h1>
        <span className="text-muted text-sm">· page {Math.floor(offset / PAGE) + 1}</span>
      </div>

      {loading && (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-28"/>)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="card p-6 text-center">
          <IInfo size={22} className="text-muted mx-auto"/>
          <p className="text-sm text-muted mt-2">No articles yet. Trigger an ingest from the <Link className="link" href="/admin">Admin</Link> page.</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {items.map(a => (
          <Link key={a.id} href={`/articles/${a.id}`} className="card card-hover p-5 block animate-slide-up">
            <div className="flex items-center gap-2 text-xs text-muted">
              {a.source && <span className="badge-slate">{a.source}</span>}
              {a.published_at && <span>· {new Date(a.published_at).toLocaleDateString()}</span>}
              {typeof a.sentiment === "number" && a.sentiment !== 0 && (
                <span className={a.sentiment > 0 ? "badge-green" : "badge-red"}>
                  {a.sentiment > 0 ? "+" : ""}{(a.sentiment * 100).toFixed(0)}
                </span>
              )}
            </div>
            <div className="font-semibold text-ink mt-2 leading-snug">{a.title}</div>
            {a.summary && <p className="text-sm text-muted mt-1.5 line-clamp-3 leading-relaxed">{a.summary}</p>}
          </Link>
        ))}
      </div>

      <div className="flex justify-between">
        <button className="btn-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>← Previous</button>
        <button className="btn-secondary" disabled={items.length < PAGE} onClick={() => setOffset(offset + PAGE)}>Next →</button>
      </div>
    </div>
  );
}
