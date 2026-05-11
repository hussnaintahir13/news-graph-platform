"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, getAuth } from "@/lib/api";
import type { AuthState } from "@/types";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => { setAuth(getAuth()); }, [pathname]);

  const link = (href: string, label: string) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link href={href} className={`px-3 py-2 rounded-md text-sm ${active ? "bg-slate-100 text-ink font-medium" : "text-muted hover:text-ink"}`}>
        {label}
      </Link>
    );
  };

  return (
    <header className="border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-14">
        <Link href="/" className="font-bold text-ink">News Graph</Link>
        <nav className="flex gap-1">
          {link("/graph", "Graph")}
          {link("/articles", "Articles")}
          {link("/search", "Search")}
          {link("/ask", "Ask AI")}
          {auth && (auth.user.role === "admin" || auth.user.role === "analyst") && link("/watchlists", "Watchlists")}
          {auth?.user.role === "admin" && link("/admin", "Admin")}
        </nav>
        <div className="text-sm">
          {auth ? (
            <div className="flex items-center gap-2">
              <span className="text-muted">{auth.user.email} · <span className="badge bg-slate-100 text-slate-700">{auth.user.role}</span></span>
              <button className="btn-ghost" onClick={() => { api.logout(); router.push("/login"); }}>Sign out</button>
            </div>
          ) : (
            <Link href="/login" className="btn-primary">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
