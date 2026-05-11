"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, Node, Edge, ConnectionMode, MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { GraphEdge as GE, GraphNode as GN, GraphResponse } from "@/types";

const TYPE_COLOR: Record<string, string> = {
  Person: "#3B82F6",
  Company: "#10B981",
  Organization: "#10B981",
  Country: "#F59E0B",
  Event: "#EF4444",
  Product: "#8B5CF6",
  Technology: "#8B5CF6",
  Narrative: "#64748B",
  Concept: "#0EA5E9",
};

export interface GraphCanvasState {
  depth: number;
  relTypeFilter: string;
  entityTypeFilter: string;
  visibleNodes: GN[];
  visibleEdges: GE[];
}

interface Props {
  entityId: string;
  entityName?: string;
  onUpdate?: (s: GraphCanvasState) => void;
}

export default function GraphCanvas({ entityId, entityName, onUpdate }: Props) {
  const router = useRouter();
  const [data, setData] = useState<GraphResponse | null>(null);
  const [depth, setDepth] = useState(1);
  const [relTypeFilter, setRelTypeFilter] = useState<string>("ALL");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setError(null); setLoading(true);
    api.graph(entityId, depth, 100).then(setData).catch(e => setError((e as Error).message)).finally(() => setLoading(false));
  }, [entityId, depth]);

  const relTypes = useMemo(() => {
    const s = new Set<string>();
    data?.edges.forEach(e => s.add(e.type));
    return ["ALL", ...Array.from(s).sort()];
  }, [data]);

  const entityTypes = useMemo(() => {
    const s = new Set<string>();
    data?.nodes.forEach(n => s.add(n.type));
    return ["ALL", ...Array.from(s).sort()];
  }, [data]);

  // Filter once, share with both the canvas renderer and the parent insights panel.
  //
  // Pipeline:
  //   1. Drop nodes whose type doesn't match the entity-type slicer (seed always kept).
  //   2. Drop edges that either touch a dropped node OR don't match the relationship slicer.
  //   3. Drop nodes that no longer have any surviving edges (seed always kept) —
  //      this is what makes the relationship slicer behave like a real filter,
  //      not just an edge-hider.
  const filtered = useMemo<{ visibleNodes: GN[]; visibleEdges: GE[] }>(() => {
    if (!data) return { visibleNodes: [], visibleEdges: [] };

    const typeAllowed = data.nodes.filter(n =>
      n.id === entityId || entityTypeFilter === "ALL" || n.type === entityTypeFilter
    );
    const typeAllowedIds = new Set(typeAllowed.map(n => n.id));

    const visibleEdges = data.edges.filter(e =>
      typeAllowedIds.has(e.source) && typeAllowedIds.has(e.target) &&
      (relTypeFilter === "ALL" || e.type === relTypeFilter)
    );

    const connectedIds = new Set<string>([entityId]);
    visibleEdges.forEach(e => { connectedIds.add(e.source); connectedIds.add(e.target); });
    const visibleNodes = typeAllowed.filter(n => connectedIds.has(n.id));

    return { visibleNodes, visibleEdges };
  }, [data, entityId, relTypeFilter, entityTypeFilter]);

  // Bubble the current view up to the parent for the Insights panel.
  useEffect(() => {
    onUpdate?.({ depth, relTypeFilter, entityTypeFilter, ...filtered });
  }, [depth, relTypeFilter, entityTypeFilter, filtered, onUpdate]);

  // Build React Flow nodes/edges from the filtered view.
  const { rfNodes, rfEdges } = useMemo<{ rfNodes: Node[]; rfEdges: Edge[] }>(() => {
    const others = filtered.visibleNodes.filter(n => n.id !== entityId);
    const r = Math.max(220, 32 * Math.sqrt(others.length || 1));
    const rfNodes: Node[] = filtered.visibleNodes.map(node => {
      const isSeed = node.id === entityId;
      const idx = others.findIndex(o => o.id === node.id);
      const angle = (idx / Math.max(1, others.length)) * Math.PI * 2;
      const color = TYPE_COLOR[node.type] || "#475569";
      return {
        id: node.id,
        position: isSeed ? { x: 0, y: 0 } : { x: Math.cos(angle) * r, y: Math.sin(angle) * r },
        data: { label: node.label },
        style: {
          background: isSeed ? "white" : color,
          color: isSeed ? color : "white",
          padding: "8px 12px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: isSeed ? 700 : 600,
          border: `2px solid ${color}`,
          boxShadow: isSeed ? "0 6px 20px rgba(59,130,246,0.25)" : "0 2px 8px rgba(15,23,42,0.12)",
          minWidth: 80,
        },
      };
    });
    const rfEdges: Edge[] = filtered.visibleEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.type.toLowerCase().replace(/_/g, " "),
      style: { strokeWidth: Math.min(4, 1 + Math.log2(e.weight + 1)), stroke: "#94A3B8" },
      labelStyle: { fontSize: 10, fill: "#475569", fontWeight: 500 },
      labelBgStyle: { fill: "white", opacity: 0.9 },
      labelBgPadding: [4, 4],
      labelBgBorderRadius: 4,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" },
    }));
    return { rfNodes, rfEdges };
  }, [filtered, entityId]);

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    router.push(`/entities/${node.id}`);
  }, [router]);

  return (
    <div className="card overflow-hidden" style={{ height: "70vh" }}>
      <div className="flex items-center flex-wrap gap-2 px-3 md:px-4 py-3 border-b bg-slate-50/60">
        <div className="text-sm min-w-0">
          <span className="font-semibold text-ink">{entityName || "Graph"}</span>
          {data && (
            <span className="text-muted ml-2 text-xs">
              · {filtered.visibleNodes.length}/{data.nodes.length} nodes
              · {filtered.visibleEdges.length}/{data.edges.length} edges
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Slicer label="Depth">
            <select className="input input-sm max-w-[64px]" value={depth} onChange={e => setDepth(Number(e.target.value))}>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </Slicer>
          <Slicer label="Entity type">
            <select className="input input-sm max-w-[150px]" value={entityTypeFilter} onChange={e => setEntityTypeFilter(e.target.value)}>
              {entityTypes.map(t => <option key={t} value={t}>{t === "ALL" ? "All types" : t}</option>)}
            </select>
          </Slicer>
          <Slicer label="Relationship">
            <select className="input input-sm max-w-[170px]" value={relTypeFilter} onChange={e => setRelTypeFilter(e.target.value)}>
              {relTypes.map(t => <option key={t} value={t}>{t === "ALL" ? "All relationships" : t.toLowerCase().replace(/_/g, " ")}</option>)}
            </select>
          </Slicer>
        </div>
      </div>
      <div className="relative" style={{ height: "calc(70vh - 56px)" }}>
        {loading && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted bg-white/60 z-10">Building graph…</div>}
        {error && <p className="p-4 text-bad text-sm">{error}</p>}
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodeClick={onNodeClick}
          fitView
          connectionMode={ConnectionMode.Loose}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} color="#E2E8F0" />
          <Controls position="bottom-right" />
          <MiniMap pannable zoomable nodeStrokeWidth={3} nodeColor={(n) => (n.style?.background as string) || "#94A3B8"} />
        </ReactFlow>
        {/* Legend — only show entity types currently in view */}
        <div className="absolute top-3 left-3 bg-white/95 border border-slate-200 rounded-lg p-2 shadow-sm max-w-[200px]">
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1">Entity type</div>
          <div className="flex flex-col gap-1">
            {entityTypes.filter(t => t !== "ALL").slice(0, 8).map(type => (
              <div key={type} className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded-full" style={{ background: TYPE_COLOR[type] || "#475569" }}/>
                <span>{type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Slicer({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-[11px] uppercase tracking-wider text-muted font-semibold">{label}</label>
      {children}
    </div>
  );
}
