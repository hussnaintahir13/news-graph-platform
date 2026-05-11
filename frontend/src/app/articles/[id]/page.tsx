"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { ArticleDetail } from "@/types";
import { IExternal, IInfo, ITag } from "@/components/Icons";

const TYPE_BADGE: Record<string, string> = {
  Person: "badge-blue", Company: "badge-green", Organization: "badge-green",
  Country: "badge-amber", Event: "badge-red", Product: "badge-violet",
  Technology: "badge-violet", Narrative: "badge-outline",
};

export default function ArticlePage() {
  const { id } = useParams() as { id: string };
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.article(id).then(setArticle).catch(e => setError((e as Error).message));
  }, [id]);

  if (error) return (
    <div className="card p-6 text-center">
      <IInfo size={22} className="text-bad mx-auto"/>
      <p className="text-sm text-bad mt-2">{error}</p>
    </div>
  );
  if (!article) return (
    <div className="space-y-3 animate-fade-in">
      <div className="skeleton h-6 w-48"/>
      <div className="skeleton h-10 w-3/4"/>
      <div className="skeleton h-4 w-full"/>
      <div className="skeleton h-4 w-full"/>
      <div className="skeleton h-4 w-5/6"/>
    </div>
  );

  return (
    <article className="space-y-5 animate-fade-in max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {article.source && <span className="badge-slate">{article.source}</span>}
        {article.author && <span className="text-muted">by {article.author}</span>}
        {article.published_at && <span className="text-muted">· {new Date(article.published_at).toLocaleString()}</span>}
        {typeof article.sentiment === "number" && article.sentiment !== 0 && (
          <span className={article.sentiment > 0 ? "badge-green" : "badge-red"}>
            sentiment {article.sentiment > 0 ? "+" : ""}{(article.sentiment * 100).toFixed(0)}
          </span>
        )}
      </div>
      <h1 className="text-3xl font-bold tracking-tight leading-tight">{article.title}</h1>
      <a href={article.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm link">
        <IExternal size={14}/> Open original
      </a>

      {article.summary && (
        <div className="card p-4 border-l-4 border-l-accent bg-accent-light/30">
          <div className="section-title mb-1">Summary</div>
          <p className="text-sm text-slate-800">{article.summary}</p>
        </div>
      )}

      <div className="prose-readable whitespace-pre-wrap">{article.content}</div>

      <section className="pt-2">
        <div className="section-title mb-2 flex items-center gap-2"><ITag size={14}/> Extracted entities</div>
        <div className="flex flex-wrap gap-2">
          {article.entities.map(e => (
            <Link key={e.id} href={`/entities/${e.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-sm hover:border-accent hover:shadow-sm transition">
              <span className="font-medium">{e.name}</span>
              <span className={TYPE_BADGE[e.type] || "badge-slate"}>{e.type}</span>
            </Link>
          ))}
          {article.entities.length === 0 && <p className="text-sm text-muted">No entities extracted yet.</p>}
        </div>
      </section>
    </article>
  );
}
