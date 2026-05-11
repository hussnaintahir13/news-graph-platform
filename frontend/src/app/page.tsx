"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, getAuth } from "@/lib/api";
import type { Article, Entity } from "@/types";
import { IArticle, IBell, IBook, IGraph, IInfo, ILogIn, ISearch, ISpark, ITrend } from "@/components/Icons";

const TYPE_BADGE: Record<string, string> = {
  Person: "badge-blue", Company: "badge-green", Organization: "badge-green",
  Country: "badge-amber", Event: "badge-red", Product: "badge-violet",
  Technology: "badge-violet", Narrative: "badge-outline",
};

export default function Home() {
  const [auth, setAuth] = useState<ReturnType<typeof getAuth>>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setAuth(getAuth()); }, []);

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      api.articles(0, 6).catch(() => []),
      api.entities("", "", 12).catch(() => []),
    ]).then(([a, e]) => { setArticles(a); setEntities(e); }).finally(() => setLoading(false));
  }, [auth]);

  if (!auth) return <Landing/>;

  return (
    <div className="space-y-10 animate-fade-in">
      <section className="card p-6 md:p-8 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-60 h-60 rounded-full opacity-30"
             style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 60%)" }}/>
        <div className="absolute -left-16 -bottom-16 w-72 h-72 rounded-full opacity-20"
             style={{ background: "radial-gradient(circle, #3B82F6 0%, transparent 60%)" }}/>
        <div className="relative">
          <div className="badge-blue inline-flex">Welcome back, {auth.user.email.split("@")[0]}</div>
          <h1 className="text-2xl md:text-3xl font-bold mt-2">What's happening in the news today?</h1>
          <p className="text-muted mt-2 max-w-xl">
            Explore connections between people, companies and countries — extracted from your live news feeds.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link href="/graph" className="btn-primary"><IGraph size={14}/> Open graph</Link>
            <Link href="/search" className="btn-secondary"><ISearch size={14}/> Search</Link>
            <Link href="/ask" className="btn-secondary"><ISpark size={14}/> Ask AI</Link>
            <Link href="/how-to" className="btn-ghost"><IBook size={14}/> How it works</Link>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <div className="flex items-center gap-2">
            <ITrend size={18} className="text-accent"/>
            <h2 className="font-semibold text-ink">Trending entities</h2>
          </div>
          <Link href="/graph" className="text-sm link">Open graph →</Link>
        </div>
        {loading && <SkeletonRow count={8}/>}
        {!loading && entities.length === 0 && <EmptyState message="No entities yet. Trigger an ingest from the Admin page." cta="/admin"/>}
        <div className="flex flex-wrap gap-2">
          {entities.map(e => (
            <Link key={e.id} href={`/entities/${e.id}`} className="group">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-sm transition group-hover:border-accent group-hover:shadow-sm">
                <span className="font-medium">{e.name}</span>
                <span className={TYPE_BADGE[e.type] || "badge-slate"}>{e.type}</span>
                <span className="text-xs text-muted">{e.mentions}×</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <div className="flex items-center gap-2">
            <IArticle size={18} className="text-accent"/>
            <h2 className="font-semibold text-ink">Recent articles</h2>
          </div>
          <Link href="/articles" className="text-sm link">All articles →</Link>
        </div>
        {loading && <SkeletonGrid count={4}/>}
        {!loading && articles.length === 0 && <EmptyState message="No articles yet. Trigger an ingest from the Admin page." cta="/admin"/>}
        <div className="grid md:grid-cols-2 gap-4">
          {articles.map(a => <ArticleCard key={a.id} a={a}/>)}
        </div>
      </section>
    </div>
  );
}

function ArticleCard({ a }: { a: Article }) {
  return (
    <Link href={`/articles/${a.id}`} className="card card-hover p-5 block animate-slide-up">
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
      {a.summary && <p className="text-sm text-muted mt-1.5 line-clamp-3">{a.summary}</p>}
    </Link>
  );
}

function SkeletonRow({ count }: { count: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: 100 + (i * 19) % 80, height: 30 }}/>
      ))}
    </div>
  );
}
function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => <div key={i} className="skeleton h-28"/>)}
    </div>
  );
}

function EmptyState({ message, cta }: { message: string; cta?: string }) {
  return (
    <div className="card p-6 text-center">
      <IInfo size={22} className="text-muted mx-auto"/>
      <p className="text-sm text-muted mt-2">{message}</p>
      {cta && <Link className="btn-secondary mt-3 inline-flex" href={cta}>Go to Admin</Link>}
    </div>
  );
}

function Landing() {
  const features = [
    { Icon: IGraph,  title: "Interactive graph",    body: "Click any node to drill in; filter edges by type; expand to 2 hops; minimap + radial layout." },
    { Icon: ISearch, title: "Hybrid search",        body: "Keyword (SQL), semantic (sentence-transformer cosine), and entity-name search side by side." },
    { Icon: ISpark,  title: "AI Q&A",               body: "Ask the index in plain English. Uses OpenAI if a key is configured, deterministic fallback otherwise." },
    { Icon: IBell,   title: "Live watchlists",      body: "Watch any entity; get an alert when a new article mentions it." },
    { Icon: IArticle,title: "Auditable extractions",body: "Every entity links to its source articles; every relationship records confidence + weight + timestamp." },
    { Icon: IBook,   title: "Privacy-first",        body: "No data leaves your server unless you set OPENAI_API_KEY. Everything runs on your infrastructure." },
  ];
  return (
    <div className="space-y-12 animate-fade-in">
      <section className="text-center max-w-3xl mx-auto pt-6">
        <div className="badge-blue inline-flex mb-3">AI News Relationship Map</div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Map the <span className="gradient-text">narratives</span> behind the headlines.
        </h1>
        <p className="text-muted mt-4 text-lg leading-relaxed">
          Continuously ingest news, extract entities and relationships, and explore them as a living interactive graph.
        </p>
        <div className="flex justify-center gap-3 mt-6 flex-wrap">
          <Link href="/login" className="btn-primary"><ILogIn size={14}/> Sign in to start</Link>
          <Link href="/how-to" className="btn-secondary"><IBook size={14}/> How it works</Link>
        </div>
        <p className="text-xs text-muted mt-3">
          Default admin: <code className="kbd">admin@example.com</code> / <code className="kbd">admin1234</code>
        </p>
      </section>

      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map(({ Icon, title, body }, i) => (
          <div key={i} className="card card-hover p-5">
            <div className="w-10 h-10 rounded-lg bg-accent-light text-accent-dark flex items-center justify-center mb-3">
              <Icon size={18}/>
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">{body}</p>
          </div>
        ))}
      </section>

      <section className="card p-6 md:p-8 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-60 h-60 rounded-full opacity-20"
             style={{ background: "radial-gradient(circle, #F43F5E 0%, transparent 60%)" }}/>
        <div className="relative grid md:grid-cols-[1fr_auto] gap-4 items-center">
          <div>
            <h2 className="text-xl font-bold">Built on familiar parts.</h2>
            <p className="text-muted text-sm mt-1">FastAPI · spaCy · sentence-transformers · React Flow · Next.js. Swap in Neo4j or Postgres without touching the frontend.</p>
          </div>
          <Link href="/how-to" className="btn-primary justify-self-start md:justify-self-end">
            <IBook size={14}/> Read the user guide
          </Link>
        </div>
      </section>
    </div>
  );
}
