import Link from "next/link";
import ProcessFlow from "@/components/ProcessFlow";
import { IBell, IChevron, IGraph, IInfo, ISearch, ISettings, ISpark } from "@/components/Icons";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Does this send my data to any third party?",
    a: "No. By default the visual works entirely on your own server. The only outbound call is to public news feeds (RSS / sitemap / article URLs) for ingestion. If you set an OPENAI_API_KEY in the backend .env, the Q&A page will call OpenAI; otherwise it uses a built-in deterministic fallback. Either way, no telemetry leaves the app.",
  },
  {
    q: "How are entities and relationships found?",
    a: "Entities come from spaCy's named-entity recogniser (Person / Organization / GPE / Product / Event / etc.). Relationships are derived two ways: (1) sentence-level co-occurrence — if A and B appear in the same sentence, an edge is created; and (2) cue-word regex — phrases like 'acquired', 'invested in', 'partnered with', 'sanctioned' upgrade the edge type and confidence.",
  },
  {
    q: "Can I add my own news sources?",
    a: "Yes — sign in as admin, open the Admin page, paste any RSS feed URL, sitemap URL, or single article URL, and click Add. The scheduler picks it up on the next tick (every 30 minutes by default), or click Run ingest now to trigger immediately.",
  },
  {
    q: "What is the difference between keyword, semantic, and entity search?",
    a: "Keyword does a SQL LIKE on the article title and body. Semantic embeds your query with sentence-transformers and ranks articles by cosine similarity — better at finding meaning, not exact words. Entity search matches the entity name directly.",
  },
  {
    q: "Why does the first ingest take so long?",
    a: "On first run, two models download from Hugging Face: the spaCy English model (~13 MB) and sentence-transformers/all-MiniLM-L6-v2 (~80 MB). After that, ingest is fast — typically <1 second per article.",
  },
  {
    q: "How do watchlists and alerts work?",
    a: "Sign in as admin or analyst, open any entity page, click Watch. When the next ingestion pass finds that entity mentioned in a new article, an alert is created. View them under Watchlists.",
  },
  {
    q: "Can I plug in Neo4j for the graph store?",
    a: "Yes. The codebase has a single seam — backend/app/services/graph_service.py. Implement Neo4jGraphService with the same interface, register it, and the rest of the app stays unchanged. Recommended once you exceed ~5M edges.",
  },
  {
    q: "Is this production-ready?",
    a: "It's a credible MVP. Before serving real users you'd typically: (1) swap SQLite for Postgres, (2) put Nginx + HTTPS in front, (3) move secrets to a secret manager, (4) rotate JWT_SECRET, (5) set CORS to your real domain. The README has a 'Production swap' table for each layer.",
  },
];

export default function HowToPage() {
  return (
    <div className="space-y-10 animate-fade-in">
      {/* Hero */}
      <section className="text-center max-w-3xl mx-auto pt-4">
        <div className="badge-blue inline-flex">User guide</div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-3">How News Graph works</h1>
        <p className="text-muted mt-3">
          A guided tour from raw news feed to interactive entity graph — and answers to the questions people ask most.
        </p>
      </section>

      {/* Process flow */}
      <ProcessFlow />

      {/* How-to cards */}
      <section>
        <div className="section-title mb-3">Hands-on walkthrough</div>
        <div className="grid md:grid-cols-2 gap-4">
          <Step n={1} icon={<ISettings size={18}/>} title="Add a source">
            Open <Link className="link" href="/admin">Admin</Link>, paste an RSS URL like <code className="kbd">https://feeds.bbci.co.uk/news/world/rss.xml</code>, click <b>Add</b>, then <b>Run ingest now</b>.
          </Step>
          <Step n={2} icon={<ISearch size={18}/>} title="Find an entity">
            Go to <Link className="link" href="/explore">Explore</Link> or <Link className="link" href="/library">Library</Link>, start typing a name. Suggestions appear as you type — click one to commit.
          </Step>
          <Step n={3} icon={<IGraph size={18}/>} title="Explore the graph">
            Use the depth dropdown to expand to 2 hops. Click any node to drill into that entity's page; filter edges by relationship type.
          </Step>
          <Step n={4} icon={<ISpark size={18}/>} title="Ask the AI">
            Open <Link className="link" href="/insights">Insights</Link> and ask questions like <i>“How is Nvidia connected to OpenAI?”</i> Answers cite source articles.
          </Step>
          <Step n={5} icon={<IBell size={18}/>} title="Watch entities">
            On any entity page click <b>Watch</b>. The next ingestion pass that mentions it creates an alert in <Link className="link" href="/watchlists">Watchlists</Link>.
          </Step>
          <Step n={6} icon={<IInfo size={18}/>} title="Audit everything">
            Every entity page lists the underlying articles. Every relationship records its confidence, weight, and the date it was observed.
          </Step>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="section-title mb-3">Frequently asked</div>
        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <details key={i} className="faq">
              <summary>
                <span>{f.q}</span>
                <IChevron className="faq-chev text-muted" size={18}/>
              </summary>
              <p className="text-sm text-slate-700 mt-3 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-muted pt-2">
        Built by Syed Hussnain · <a className="link" href="https://github.com/hussnaintahir13/news-graph-platform" target="_blank" rel="noreferrer">Source on GitHub</a>
      </p>
    </div>
  );
}

function Step({ n, icon, title, children }: { n: number; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card card-hover p-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent-light text-accent-dark flex items-center justify-center">{icon}</div>
        <div className="font-semibold">Step {n} · {title}</div>
      </div>
      <p className="text-sm text-slate-700 mt-2 leading-relaxed">{children}</p>
    </div>
  );
}
