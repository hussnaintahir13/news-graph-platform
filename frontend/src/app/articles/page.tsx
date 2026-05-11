"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Article } from "@/types";

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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Articles</h1>
      {loading && <p className="text-muted">Loading…</p>}
      <div className="grid md:grid-cols-2 gap-4">
        {items.map(a => (
          <Link key={a.id} href={`/articles/${a.id}`} className="card p-4 hover:shadow-md transition">
            <div className="text-xs text-muted">{a.source}{a.published_at ? ` · ${new Date(a.published_at).toLocaleString()}` : ""}</div>
            <div className="font-medium mt-1">{a.title}</div>
            {a.summary && <p className="text-sm text-muted mt-1 line-clamp-3">{a.summary}</p>}
          </Link>
        ))}
      </div>
      <div className="flex justify-between">
        <button className="btn-ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>← Previous</button>
        <button className="btn-ghost" disabled={items.length < PAGE} onClick={() => setOffset(offset + PAGE)}>Next →</button>
      </div>
    </div>
  );
}
