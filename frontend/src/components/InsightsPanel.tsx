"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { AskResponse, EntityDetail, GraphEdge, GraphNode } from "@/types";
import type { GraphCanvasState } from "./GraphCanvas";
import { IArticle, IInfo, ISpark, ITag } from "./Icons";

interface Props {
  entityId: string;
  view: GraphCanvasState | null;
}

/** Live insights below the graph. Static info comes from the entity detail.
 *  "Current view" summary reactively updates with depth/type filters. */
export default function InsightsPanel({ entityId, view }: Props) {
  const [ent, setEnt] = useState<EntityDetail | null>(null);
  const [ai, setAi] = useState<AskResponse | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    setEnt(null); setAi(null);
    api.entity(entityId).then(setEnt).catch(() => {});
  }, [entityId]);

  // Build a deterministic "current view" sentence whenever filters change.
  const viewSummary = useMemo(() => {
    if (!view || !ent) return null;
    const others = view.visibleNodes.filter(n => n.id !== entityId);
    const totalEdges = view.visibleEdges.length;

    if (others.length === 0) {
      return `No connections are visible with the current filters.`;
    }

    const typeCounts: Record<string, number> = {};
    others.forEach(n => { typeCounts[n.type] = (typeCounts[n.type] || 0) + 1; });
    const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    const relCounts: Record<string, number> = {};
    view.visibleEdges.forEach(e => { relCounts[e.type] = (relCounts[e.type] || 0) + 1; });
    const topRels = Object.entries(relCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    const filtersBits: string[] = [];
    if (view.entityTypeFilter !== "ALL") filtersBits.push(`only ${view.entityTypeFilter} entities`);
    if (view.relTypeFilter !== "ALL") filtersBits.push(`only "${view.relTypeFilter.toLowerCase().replace(/_/g, " ")}" relationships`);
    const filterPhrase = filtersBits.length ? ` (filtered to ${filtersBits.join(" and ")})` : "";

    return {
      filterPhrase,
      others: others.length,
      totalEdges,
      topTypes,
      topRels,
    };
  }, [view, ent, entityId]);

  async function generateAi() {
    if (!ent) return;
    setAiBusy(true);
    try {
      const question = view && (view.relTypeFilter !== "ALL" || view.entityTypeFilter !== "ALL")
        ? `Summarise what news says about ${ent.name}, focusing on ${
            view.entityTypeFilter !== "ALL" ? view.entityTypeFilter + " connections" : ""
          }${view.entityTypeFilter !== "ALL" && view.relTypeFilter !== "ALL" ? " and " : ""}${
            view.relTypeFilter !== "ALL" ? `"${view.relTypeFilter.toLowerCase().replace(/_/g, " ")}" relationships` : ""
          }.`
        : `Tell me about ${ent.name} based on indexed news.`;
      setAi(await api.ask(question));
    } finally { setAiBusy(false); }
  }

  if (!ent) {
    return <div className="card p-4"><div className="skeleton h-20"/></div>;
  }

  return (
    <div className="card p-4 md:p-5 space-y-4 animate-fade-in">
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ISpark size={18} className="text-accent"/>
          <h3 className="font-semibold text-ink">Insights · {ent.name}</h3>
        </div>
        <Link className="text-sm link" href={`/entities/${ent.id}`}>Open full profile →</Link>
      </header>

      {ent.description && (
        <p className="text-sm leading-relaxed text-slate-700">{ent.description}</p>
      )}

      {/* Current view summary — adapts to filters */}
      {viewSummary && typeof viewSummary === "object" && (
        <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-100">
          <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-1.5">Current view{viewSummary.filterPhrase}</div>
          <p className="text-sm text-slate-700 leading-relaxed">
            {ent.name} is connected to <b>{viewSummary.others}</b> other {viewSummary.others === 1 ? "entity" : "entities"} in this view, across <b>{viewSummary.totalEdges}</b> relationships.
            {viewSummary.topTypes.length > 0 && (
              <> The most common entity types are{" "}
                {viewSummary.topTypes.map(([t, n], i) => (
                  <span key={t}>
                    <b>{t}</b> ({n}){i < viewSummary.topTypes.length - 1 ? ", " : ""}
                  </span>
                ))}.
              </>
            )}
            {viewSummary.topRels.length > 0 && (
              <> Top relationship types:{" "}
                {viewSummary.topRels.map(([t, n], i) => (
                  <span key={t}>
                    <b>{t.toLowerCase().replace(/_/g, " ")}</b> ({n}){i < viewSummary.topRels.length - 1 ? ", " : ""}
                  </span>
                ))}.
              </>
            )}
          </p>
        </div>
      )}
      {typeof viewSummary === "string" && (
        <p className="text-sm text-muted">{viewSummary}</p>
      )}

      {/* AI answer */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">AI summary</div>
          <button className="btn-ghost text-xs" onClick={generateAi} disabled={aiBusy}>
            <ISpark size={12}/> {aiBusy ? "Thinking…" : ai ? "Regenerate" : "Generate"}
          </button>
        </div>
        {ai ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{ai.answer}</p>
            {ai.sources.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted">Sources:</span>
                {ai.sources.slice(0, 4).map(s => (
                  <Link key={s.id} href={`/articles/${s.id}`} className="link text-xs flex items-center gap-1">
                    <IArticle size={11}/> {s.title.slice(0, 60)}{s.title.length > 60 ? "…" : ""}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Click <b>Generate</b> to get a 2-3 sentence summary based on the current view, citing the articles it came from.</p>
        )}
      </div>
    </div>
  );
}
