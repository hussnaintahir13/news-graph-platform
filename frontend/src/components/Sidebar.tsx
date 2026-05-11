"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getAuth } from "@/lib/api";
import {
  IArticle, IBell, IBook, IExplore, IGraph, IHeart, IHome, ILibrary, ISettings, ISpark, IX,
} from "./Icons";

// Everything navigable lives here. The drawer presents PRIMARY + SECONDARY together so it's
// the single source of truth for navigation on mobile, while on desktop it complements the top bar.
type Item = { href: string; label: string; Icon: React.ComponentType<{ size?: number; className?: string }>; roles?: string[] };

const PRIMARY: Item[] = [
  { href: "/", label: "Home", Icon: IHome },
  { href: "/explore", label: "Explore graph", Icon: IExplore },
  { href: "/library", label: "Article library", Icon: ILibrary },
  { href: "/insights", label: "Insights & Ask AI", Icon: ISpark },
];

const SECONDARY: Item[] = [
  { href: "/interests", label: "My interests", Icon: IHeart },
  { href: "/watchlists", label: "Watchlists & alerts", Icon: IBell, roles: ["admin", "analyst"] },
  { href: "/admin", label: "Admin — sources", Icon: ISettings, roles: ["admin"] },
  { href: "/how-to", label: "How it works", Icon: IBook },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [auth, setAuth] = useState<ReturnType<typeof getAuth>>(null);

  useEffect(() => { setAuth(getAuth()); }, []);
  useEffect(() => {
    function esc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const visible = (item: Item) => !item.roles || (auth && item.roles.includes(auth.user.role));

  return (
    <>
      {/* Backdrop */}
      <div
        className={"fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity " +
          (open ? "opacity-100" : "opacity-0 pointer-events-none")}
        onClick={onClose}
      />
      {/* Drawer */}
      <aside
        className={"fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] bg-white shadow-2xl z-50 transform transition-transform duration-200 ease-out " +
          (open ? "translate-x-0" : "-translate-x-full")}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                 style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}>
              <IGraph size={16} className="text-white"/>
            </div>
            <span className="font-bold">News Graph</span>
          </div>
          <button onClick={onClose} aria-label="Close menu" className="btn-ghost p-2 rounded-lg">
            <IX size={18}/>
          </button>
        </div>

        <div className="p-3 space-y-4 overflow-y-auto">
          <Group title="Main">
            {PRIMARY.map(item => <NavLink key={item.href} item={item} pathname={pathname}/>)}
          </Group>
          <Group title="More">
            {SECONDARY.filter(visible).map(item => <NavLink key={item.href} item={item} pathname={pathname}/>)}
          </Group>
          {auth && (
            <div className="p-3 rounded-lg bg-slate-50">
              <div className="text-[11px] uppercase tracking-wider text-muted">Signed in as</div>
              <div className="text-sm font-medium truncate">{auth.user.email}</div>
              <div className="text-xs text-muted mt-0.5">Role: <span className="badge-slate text-[10px]">{auth.user.role}</span></div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function NavLink({ item, pathname }: { item: Item; pathname: string }) {
  const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
  const Icon = item.Icon;
  return (
    <Link href={item.href}
          className={"flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition " +
            (active
              ? "bg-accent-light text-accent-dark font-semibold"
              : "text-slate-700 hover:bg-slate-100")}>
      <Icon size={16}/>
      <span>{item.label}</span>
    </Link>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-3 mb-1 text-[10px] uppercase tracking-wider text-muted font-semibold">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
