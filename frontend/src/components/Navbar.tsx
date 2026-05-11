"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, getAuth } from "@/lib/api";
import type { AuthState } from "@/types";
import {
  IArticle, IBell, IBook, IConnect, IGraph, IHome, ILogIn, ILogOut, ISearch, ISettings, ISpark,
} from "./Icons";

const NAV: { href: string; label: string; Icon: React.ComponentType<{size?: number; className?: string}>; roles?: string[] }[] = [
  { href: "/", label: "Home", Icon: IHome },
  { href: "/graph", label: "Graph", Icon: IGraph },
  { href: "/connect", label: "Connect", Icon: IConnect },
  { href: "/articles", label: "Articles", Icon: IArticle },
  { href: "/search", label: "Search", Icon: ISearch },
  { href: "/ask", label: "Ask AI", Icon: ISpark },
  { href: "/watchlists", label: "Watchlists", Icon: IBell, roles: ["admin", "analyst"] },
  { href: "/admin", label: "Admin", Icon: ISettings, roles: ["admin"] },
  { href: "/how-to", label: "How it works", Icon: IBook },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => { setAuth(getAuth()); }, [pathname]);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
               style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}>
            <IGraph size={16} className="text-white"/>
          </div>
          <span className="font-bold tracking-tight text-ink">News Graph</span>
        </Link>

        <nav className="hidden md:flex items-center gap-0.5">
          {NAV.map(({ href, label, Icon, roles }) => {
            if (roles && !(auth && roles.includes(auth.user.role))) return null;
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={"flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition " +
                  (active ? "bg-accent-light text-accent-dark font-semibold" : "text-muted hover:text-ink hover:bg-slate-100")}
              >
                <Icon size={14}/>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="text-sm">
          {auth ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:flex items-center gap-2">
                <span className="text-muted">{auth.user.email}</span>
                <span className={
                  "badge " +
                  (auth.user.role === "admin" ? "badge-violet"
                    : auth.user.role === "analyst" ? "badge-blue"
                    : "badge-slate")
                }>{auth.user.role}</span>
              </span>
              <button className="btn-ghost" onClick={() => { api.logout(); router.push("/login"); }}>
                <ILogOut size={14}/> Sign out
              </button>
            </div>
          ) : (
            <Link href="/login" className="btn-primary">
              <ILogIn size={14}/> Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
