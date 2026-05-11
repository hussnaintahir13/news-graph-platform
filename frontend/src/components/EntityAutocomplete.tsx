"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Entity } from "@/types";
import { ISearch, ITag } from "./Icons";

interface Props {
  placeholder?: string;
  autoFocus?: boolean;
  onSelect: (entity: Entity) => void;
  pickFirstOnEnter?: boolean;
}

const TYPE_COLOR: Record<string, string> = {
  Person: "badge-blue",
  Company: "badge-green",
  Organization: "badge-green",
  Country: "badge-amber",
  Event: "badge-red",
  Product: "badge-violet",
  Technology: "badge-violet",
  Narrative: "badge-outline",
};

export default function EntityAutocomplete({ placeholder = "Search people, companies, countries…", autoFocus, onSelect, pickFirstOnEnter = true }: Props) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Entity[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Click-outside
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!q.trim()) { setItems([]); return; }
    setLoading(true);
    const h = setTimeout(async () => {
      try {
        const rows = await api.entities(q, "", 12);
        setItems(rows);
        setActive(0);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(h);
  }, [q]);

  function commit(e: Entity) {
    onSelect(e);
    setQ("");
    setItems([]);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && pickFirstOnEnter && items[active]) { e.preventDefault(); commit(items[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-lg">
      <div className="relative">
        <ISearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16}/>
        <input
          autoFocus={autoFocus}
          className="input pl-9"
          placeholder={placeholder}
          value={q}
          onChange={e => { setQ(e.target.value); if (e.target.value) setOpen(true); }}
          onFocus={() => { if (items.length) setOpen(true); }}
          onKeyDown={onKey}
          aria-autocomplete="list"
        />
      </div>
      {open && (
        <div className="combo">
          {loading && items.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted">Searching…</div>
          )}
          {!loading && items.length === 0 && q && (
            <div className="px-3 py-2 text-sm text-muted">No matches for “{q}”.</div>
          )}
          {items.map((e, idx) => (
            <button
              type="button"
              key={e.id}
              className={"combo-item w-full text-left " + (idx === active ? "active" : "")}
              onMouseEnter={() => setActive(idx)}
              onClick={() => commit(e)}
            >
              <span className="flex items-center gap-2 min-w-0">
                <ITag size={14} className="text-muted shrink-0"/>
                <span className="truncate font-medium">{e.name}</span>
                <span className={TYPE_COLOR[e.type] || "badge-slate"}>{e.type}</span>
              </span>
              <span className="text-xs text-muted shrink-0">{e.mentions}×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
