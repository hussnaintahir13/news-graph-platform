"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { ArticleDetail } from "@/types";

export default function ArticlePage() {
  const { id } = useParams() as { id: string };
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.article(id).then(setArticle).catch(e => setError((e as Error).message));
  }, [id]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!article) return <p className="text-muted">Loading…</p>;

  return (
    <article className="space-y-4">
      <div className="text-xs text-muted">{article.source}{article.published_at ? ` · ${new Date(article.published_at).toLocaleString()}` : ""}</div>
      <h1 className="text-2xl font-bold">{article.title}</h1>
      <a href={article.url} target="_blank" rel="noreferrer" className="text-sm text-accent underline">Open original ↗</a>
      {article.summary && <p className="card p-4 text-sm">{article.summary}</p>}
      <div className="prose max-w-none whitespace-pre-wrap leading-relaxed">{article.content}</div>
      <section>
        <h2 className="font-semibold mb-2">Extracted entities</h2>
        <div className="flex flex-wrap gap-2">
          {article.entities.map(e => (
            <Link key={e.id} href={`/entities/${e.id}`} className="badge bg-slate-100 hover:bg-slate-200 text-slate-700">
              {e.name} <span className="ml-1 text-muted">{e.type}</span>
            </Link>
          ))}
          {article.entities.length === 0 && <p className="text-sm text-muted">No entities extracted yet.</p>}
        </div>
      </section>
    </article>
  );
}
