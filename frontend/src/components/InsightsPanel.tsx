"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { AskResponse, EntityDetail } from "@/types";
import type { GraphCanvasState } from "./GraphCanvas";
import { IArticle, IFilter, IInfo, ISpark } from "./Icons";

interface Props {
  entityId: string;
  view: GraphCanvasState | null;
}

/** Filter-aware insights below the graph.
 *
 *  - Deterministic "Current view" sentence — updates instantly with every filter change.
 *  - AI summary — pulls only the articles that produced the currently-visible edges.
 *    Cleared automatically whenever a filter changes, so the user can never look at a
 *    stale summary that doesn't match what they're seeing in the graph.
 */
export default function InsightsPanel({ entityId, view }: Props) {
  const [ent, setEnt] = useState<EntityDetail | null>(null);
  const [ai, setAi] = useState<AskResponse | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // Track the filter signature the current summary was generated against,
  // so we can mark it stale if filters change afterwards.
  const aiSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    setEnt(null); setAi(null); setAiError(null); aiSignatureRef.current = null;
    api.entity(entityId).then(setEnt).catch(() => {});
  }, [entityId]);

  const currentSig = useMemo(() => {
    if (!view) return null;
    return `${view.depth}|${view.entityTypeFilter}|${view.relTypeFilter}|${view.visibleEdges.length}|${view.visibleNodes.length}`;
  }, [view]);

  // Auto-fire the scoped insight whenever the filter signature changes (debounced).
  // - Clears stale text immediately so the user never sees a summary that doesn't match.
  // - Re-runs after a short debounce so rapid slicer changes don't hammer the API.
  useEffect(() => {
    if (!ent || !view) return;
    // Clear previous output immediately so we never look at stale text.
    if (aiSignatureRef.current && aiSignatureRef.current !== currentSig) {
      setAi(null);
      setAiError(null);
    }
    if (view.visibleEdges.length === 0) {
      // Nothing in scope — don't bother calling the API.
      return;
    }
    const timer = setTimeout(() => { generateAi(); }, 600);
    return () => clearTimeout(timer);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [currentSig, ent?.id]);

  const viewSummary = useMemo(() => {
    if (!view || !ent) return null;
    const others = view.visibleNodes.filter(n => n.id !== entityId);
    const totalEdges = view.visibleEdges.length;

    if (others.length === 0) {
      return "No connections are visible with the current filters. Relax the slicers above to see more.";
    }

    const typeCounts: Record<string, number> = {};
    others.forEach(n => { typeCounts[n.type] = (typeCounts[n.type] || 0) + 1; });
    const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    const relCounts: Record<string, number> = {};
    view.visibleEdges.forEach(e => { relCounts[e.type] = (relCounts[e.type] || 0) + 1; });
    const topRels = Object.entries(relCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    const filterBits: string[] = [];
    if (view.entityTypeFilter !== "ALL") filterBits.push(`only ${view.entityTypeFilter} entities`);
    if (view.relTypeFilter !== "ALL") filterBits.push(`only "${view.relTypeFilter.toLowerCase().replace(/_/g, " ")}" relationships`);
    const filterPhrase = filterBits.length ? ` (filtered to ${filterBits.join(" and ")})` : "";

    return { filterPhrase, others: others.length, totalEdges, topTypes, topRels };
  }, [view, ent, entityId]);

  async function generateAi() {
    if (!ent || !view) return;
    setAiBusy(true); setAiError(null);
    try {
      const res = await api.scopedInsight({
        subject_id: ent.id,
        relationship_ids: view.visibleEdges.map(e => e.id),
        entity_ids: view.visibleNodes.map(n => n.id),
        rel_type_filter: view.relTypeFilter,
        entity_type_filter: view.entityTypeFilter,
      });
      setAi(res);
      aiSignatureRef.current = currentSig;
    } catch (e) {
      setAiError((e as Error).message);
    } finally { setAiBusy(false); }
  }

  if (!ent) {
    return <div className="card p-4"><div className="skeleton h-20"/></div>;
  }

  const hasFilters = view && (view.relTypeFilter !== "ALL" || view.entityTypeFilter !== "ALL");
  const inScopeCount = view ? view.visibleEdges.length : 0;

  return (
    <div className="card p-4 md:p-5 space-y-4 animate-fade-in">
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ISpark size={18} className="text-accent"/>
          <h3 className="font-semibold text-ink">Insights · {ent.name}</h3>
          {hasFilters && (
            <span className="badge-amber text-[10px] flex items-center gap-1"><IFilter size={10}/> filtered view</span>
          )}
        </div>
        <Link className="text-sm link" href={`/entities/${ent.id}`}>Open full profile →</Link>
      </header>

      {ent.description && (
        <p className="text-sm leading-relaxed text-slate-700">{ent.description}</p>
      )}

      {viewSummary && typeof viewSummary === "object" && (
        <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-100">
          <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-1.5">
            Current view{viewSummary.filterPhrase}
          </div>
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

      {/* AI answer — scoped to the visible edges */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">AI summary</div>
            {view && (
              <span className="text-[11px] text-muted">
                based on <b>{inScopeCount}</b> relationship{inScopeCount === 1 ? "" : "s"} in this view
              </span>
            )}
          </div>
          <button className="btn-ghost text-xs" onClick={generateAi} disabled={aiBusy || !view || inScopeCount === 0}>
            <ISpark size={12}/> {aiBusy ? "Updating…" : "Refresh"}
          </button>
        </div>

        {aiError && (
          <div className="text-sm text-bad flex items-center gap-2"><IInfo size={14}/> {aiError}</div>
        )}

        {aiBusy && !ai && <div className="skeleton h-16"/>}

        {ai ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap"
               dangerouslySetInnerHTML={{ __html: ai.answer.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") }}/>
            {ai.sources.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted">Sources in scope:</span>
                {ai.sources.slice(0, 6).map(s => (
                  <Link key={s.id} href={`/articles/${s.id}`} className="link text-xs flex items-center gap-1">
                    <IArticle size={11}/> {s.title.slice(0, 60)}{s.title.length > 60 ? "…" : ""}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (!aiBusy && (
          <p className="text-sm text-muted">
            {inScopeCount === 0
              ? "No relationships in the current view — nothing to summarise. Adjust the slicers above."
              : <>Generating a summary scoped to the <b>{inScopeCount}</b> visible relationship{inScopeCount === 1 ? "" : "s"}…</>
            }
          </p>
        ))}
      </div>
    </div>
  );
}
