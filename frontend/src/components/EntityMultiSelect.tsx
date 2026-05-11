"use client";

import { useEffect, useRef, useState } from "react";
import { api, getAuth } from "@/lib/api";
import type { Entity, EntityType } from "@/types";
import { IPlus, ISearch, ITag, IX } from "./Icons";

const TYPE_BADGE: Record<string, string> = {
  Person: "badge-blue", Company: "badge-green", Organization: "badge-green",
  Country: "badge-amber", Event: "badge-red", Product: "badge-violet",
  Technology: "badge-violet", Narrative: "badge-outline", Concept: "badge-outline",
};

interface Props {
  selected: Entity[];
  onChange: (next: Entity[]) => void;
  placeholder?: string;
  allowCreate?: boolean;
}

export default function EntityMultiSelect({ selected, onChange, placeholder = "Add a person, company or concept…", allowCreate = true }: Props) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Entity[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [auth, setAuth] = useState<ReturnType<typeof getAuth>>(null);
  useEffect(() => { setAuth(getAuth()); }, []);
  const canCreate = allowCreate && auth && (auth.user.role === "admin" || auth.user.role === "analyst");

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!q.trim()) { setItems([]); return; }
    setLoading(true);
    const h = setTimeout(async () => {
      try {
        const rows = await api.entities(q, "", 12);
        const selectedIds = new Set(selected.map(s => s.id));
        setItems(rows.filter(r => !selectedIds.has(r.id)));
        setActive(0); setOpen(true);
      } finally { setLoading(false); }
    }, 180);
    return () => clearTimeout(h);
  }, [q, selected]);

  function addEntity(e: Entity) {
    if (selected.some(s => s.id === e.id)) return;
    onChange([...selected, e]);
    setQ(""); setItems([]); setOpen(false);
    inputRef.current?.focus();
  }

  function removeEntity(id: string) {
    onChange(selected.filter(s => s.id !== id));
  }

  async function createNew() {
    if (!q.trim() || creating) return;
    setCreating(true);
    try {
      const e = await api.createEntity(q.trim(), "Concept");
      addEntity(e);
    } catch (err) {
      alert((err as Error).message);
    } finally { setCreating(false); }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !q && selected.length) {
      e.preventDefault(); removeEntity(selected[selected.length - 1].id); return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (items[active]) addEntity(items[active]);
      else if (canCreate) createNew();
    }
    else if (e.key === "Escape") { setOpen(false); }
  }

  const noMatch = !loading && q.trim() && items.length === 0;

  return (
    <div ref={boxRef} className="relative">
      <div className="flex flex-wrap items-center gap-2 input min-h-[44px] py-2 cursor-text" onClick={() => inputRef.current?.focus()}>
        {selected.map(s => (
          <span key={s.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-light text-accent-dark text-sm">
            <ITag size={12}/>
            <span className="font-medium">{s.name}</span>
            <span className={"text-[10px] " + (TYPE_BADGE[s.type] || "badge-slate")}>{s.type}</span>
            <button type="button" onClick={(ev) => { ev.stopPropagation(); removeEntity(s.id); }} aria-label={`Remove ${s.name}`}
                    className="ml-0.5 hover:bg-white/60 rounded p-0.5 transition">
              <IX size={12}/>
            </button>
          </span>
        ))}
        <div className="relative flex-1 min-w-[140px]">
          <ISearch size={14} className="absolute left-1 top-1/2 -translate-y-1/2 text-muted"/>
          <input
            ref={inputRef}
            className="bg-transparent outline-none w-full pl-6 py-1 text-sm placeholder:text-muted"
            placeholder={selected.length === 0 ? placeholder : "Add another…"}
            value={q}
            onChange={e => { setQ(e.target.value); if (e.target.value) setOpen(true); }}
            onFocus={() => { if (items.length) setOpen(true); }}
            onKeyDown={onKey}
          />
        </div>
      </div>

      {open && (q.trim() || items.length > 0) && (
        <div className="combo">
          {loading && items.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted">Searching…</div>
          )}
          {items.map((e, idx) => (
            <button
              type="button"
              key={e.id}
              className={"combo-item w-full text-left " + (idx === active ? "active" : "")}
              onMouseEnter={() => setActive(idx)}
              onClick={() => addEntity(e)}
            >
              <span className="flex items-center gap-2 min-w-0">
                <ITag size={14} className="text-muted shrink-0"/>
                <span className="truncate font-medium">{e.name}</span>
                <span className={TYPE_BADGE[e.type] || "badge-slate"}>{e.type}</span>
              </span>
              <span className="text-xs text-muted shrink-0">{e.mentions}×</span>
            </button>
          ))}
          {noMatch && (
            <div className="px-3 py-2 text-sm">
              {canCreate ? (
                <button type="button" onClick={createNew} disabled={creating}
                        className="flex items-center gap-2 w-full hover:text-accent transition">
                  <IPlus size={14}/> {creating ? "Adding…" : <>Add <b>“{q}”</b> as a new entity</>}
                </button>
              ) : (
                <span className="text-muted">No match. Sign in as admin/analyst to add new entities.</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
