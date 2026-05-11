"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, Node, Edge, ConnectionMode,
} from "reactflow";
import "reactflow/dist/style.css";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { GraphResponse } from "@/types";

const TYPE_COLOR: Record<string, string> = {
  Person: "#0078D4",
  Company: "#107C10",
  Organization: "#107C10",
  Country: "#D9822B",
  Event: "#A4262C",
  Product: "#5C2D91",
  Technology: "#5C2D91",
  Narrative: "#605E5C",
};

interface Props { entityId: string; }

export default function GraphCanvas({ entityId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<GraphResponse | null>(null);
  const [depth, setDepth] = useState(1);
  const [relTypeFilter, setRelTypeFilter] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api.graph(entityId, depth, 100).then(setData).catch(e => setError((e as Error).message));
  }, [entityId, depth]);

  const relTypes = useMemo(() => {
    const s = new Set<string>();
    data?.edges.forEach(e => s.add(e.type));
    return ["ALL", ...Array.from(s).sort()];
  }, [data]);

  const { nodes, edges } = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    if (!data) return { nodes: [], edges: [] };
    const visibleEdges = data.edges.filter(e => relTypeFilter === "ALL" || e.type === relTypeFilter);
    // Simple radial layout: center seed, others on a circle.
    const n = data.nodes.length;
    const r = Math.max(200, 30 * Math.sqrt(n));
    const others = data.nodes.filter(x => x.id !== entityId);
    const rfNodes: Node[] = data.nodes.map((node, i) => {
      const isSeed = node.id === entityId;
      const idx = isSeed ? -1 : others.findIndex(o => o.id === node.id);
      const angle = (idx / Math.max(1, others.length)) * Math.PI * 2;
      return {
        id: node.id,
        position: isSeed ? { x: 0, y: 0 } : { x: Math.cos(angle) * r, y: Math.sin(angle) * r },
        data: { label: node.label, type: node.type, mentions: node.mentions },
        style: {
          background: TYPE_COLOR[node.type] || "#475569",
          color: "white",
          padding: 8,
          borderRadius: 8,
          fontSize: 12,
          fontWeight: isSeed ? 700 : 500,
          border: isSeed ? "2px solid #0F172A" : "1px solid rgba(0,0,0,0.1)",
        },
      };
    });
    const rfEdges: Edge[] = visibleEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.type,
      animated: false,
      style: { strokeWidth: Math.min(4, 1 + Math.log2(e.weight + 1)) },
      labelStyle: { fontSize: 10, fill: "#64748B" },
      labelBgStyle: { fill: "white", opacity: 0.9 },
    }));
    return { nodes: rfNodes, edges: rfEdges };
  }, [data, entityId, relTypeFilter]);

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    router.push(`/entities/${node.id}`);
  }, [router]);

  return (
    <div className="card overflow-hidden" style={{ height: "75vh" }}>
      <div className="flex items-center gap-3 px-3 py-2 border-b bg-slate-50">
        <label className="text-sm text-muted">Depth</label>
        <select className="input max-w-[80px]" value={depth} onChange={e => setDepth(Number(e.target.value))}>
          <option value={1}>1</option>
          <option value={2}>2</option>
        </select>
        <label className="text-sm text-muted ml-3">Relationship</label>
        <select className="input max-w-[180px]" value={relTypeFilter} onChange={e => setRelTypeFilter(e.target.value)}>
          {relTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="ml-auto text-xs text-muted">{data?.nodes.length ?? 0} nodes · {data?.edges.length ?? 0} edges</div>
      </div>
      <div style={{ height: "calc(75vh - 44px)" }}>
        {error && <p className="p-4 text-red-600 text-sm">{error}</p>}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={onNodeClick}
          fitView
          connectionMode={ConnectionMode.Loose}
          minZoom={0.2}
          maxZoom={2}
        >
          <Background gap={16} />
          <Controls />
          <MiniMap pannable zoomable nodeStrokeWidth={3} />
        </ReactFlow>
      </div>
    </div>
  );
}
