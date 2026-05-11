"use client";

interface Step {
  num: number;
  title: string;
  detail: string;
  color: string;
}

const STEPS: Step[] = [
  { num: 1, title: "Add sources",            detail: "Admins register RSS feeds, sitemaps, or single URLs.", color: "#3B82F6" },
  { num: 2, title: "Scheduled ingest",       detail: "APScheduler triggers every 30 min — articles fetched & deduped.", color: "#6366F1" },
  { num: 3, title: "Clean & extract",        detail: "Trafilatura strips boilerplate; spaCy NER finds people, companies, countries.", color: "#8B5CF6" },
  { num: 4, title: "Relationships",          detail: "Sentence co-occurrence + cue regex → INVESTED_IN / ACQUIRED / PARTNERED edges.", color: "#A855F7" },
  { num: 5, title: "Embed",                  detail: "Sentence-transformer creates 384-dim vector for semantic search.", color: "#D946EF" },
  { num: 6, title: "Upsert graph",           detail: "Entities deduped; edge weights accumulate; watchlist alerts fire.", color: "#EC4899" },
  { num: 7, title: "Serve interactively",    detail: "React Flow renders a subgraph; semantic search & Q&A query the live DB.", color: "#F43F5E" },
];

export default function ProcessFlow() {
  return (
    <div className="card p-6">
      <div className="section-title mb-4">How an article becomes a node in your graph</div>

      {/* SVG schematic */}
      <div className="overflow-x-auto -mx-2 px-2 pb-4">
        <svg viewBox="0 0 980 220" className="w-full min-w-[860px] h-44">
          {/* connecting curve */}
          <defs>
            <linearGradient id="pf-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"  stopColor="#3B82F6"/>
              <stop offset="50%" stopColor="#8B5CF6"/>
              <stop offset="100%" stopColor="#F43F5E"/>
            </linearGradient>
            <marker id="pf-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 z" fill="#94A3B8"/>
            </marker>
          </defs>
          <path d="M40 110 C 200 30, 400 200, 600 110 S 900 30, 940 110" stroke="url(#pf-grad)" strokeWidth="3" fill="none" opacity="0.55"/>
          {STEPS.map((s, i) => {
            const x = 40 + i * 150;
            const y = 110;
            return (
              <g key={s.num}>
                <circle cx={x} cy={y} r="22" fill="white" stroke={s.color} strokeWidth="2.5"/>
                <text x={x} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill={s.color}>{s.num}</text>
                <text x={x} y={y - 36} textAnchor="middle" fontSize="12" fontWeight="600" fill="#0B1220">{s.title}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detailed step cards */}
      <div className="grid md:grid-cols-2 gap-3 mt-2">
        {STEPS.map(s => (
          <div key={s.num} className="flow-step">
            <div className="flow-step-num" style={{ background: `linear-gradient(135deg, ${s.color}, #8B5CF6)` }}>{s.num}</div>
            <div>
              <div className="font-semibold text-ink">{s.title}</div>
              <div className="text-sm text-muted mt-0.5">{s.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
