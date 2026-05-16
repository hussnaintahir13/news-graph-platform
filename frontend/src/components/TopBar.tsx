"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, getAuth } from "@/lib/api";
import type { AuthState } from "@/types";
import {
  IExplore, IGraph, IHome, ILibrary, ILogIn, ILogOut, IMenu, ISpark, IUser,
} from "./Icons";

// Just the four primary destinations. Everything else lives in the sidebar drawer.
const TOP_NAV = [
  { href: "/", label: "Home", Icon: IHome },
  { href: "/explore", label: "Explore", Icon: IExplore },
  { href: "/library", label: "Library", Icon: ILibrary },
  { href: "/insights", label: "Insights", Icon: ISpark },
];

interface Props { onMenuClick: () => void; }

export default function TopBar({ onMenuClick }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => { setAuth(getAuth()); }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 md:px-6 flex items-center justify-between h-14 gap-2">
        <div className="flex items-center gap-2">
          <button onClick={onMenuClick} aria-label="Open menu"
                  className="btn-ghost p-2 -ml-1 hover:bg-slate-100 rounded-lg">
            <IMenu size={20}/>
          </button>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                 style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}>
              <IGraph size={16} className="text-white"/>
            </div>
            <span className="font-bold tracking-tight text-ink hidden sm:inline">NewroSense</span>
          </Link>
        </div>

        {/* Centre primary nav — hidden on mobile (use drawer) */}
        <nav className="hidden md:flex items-center gap-1">
          {TOP_NAV.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link key={href} href={href}
                    className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition " +
                      (active
                        ? "bg-accent-light text-accent-dark font-semibold"
                        : "text-muted hover:text-ink hover:bg-slate-100")}>
                <Icon size={15}/>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: user widget */}
        <div className="flex items-center gap-2 text-sm shrink-0">
          {auth ? (
            <>
              <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-lg border border-slate-200">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                     style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}>
                  {auth.user.email.charAt(0).toUpperCase()}
                </div>
                <span className="text-muted text-xs hidden lg:inline">{auth.user.email}</span>
                <span className={"text-[10px] " +
                  (auth.user.role === "admin" ? "badge-violet"
                    : auth.user.role === "analyst" ? "badge-blue"
                    : "badge-slate")
                }>{auth.user.role}</span>
              </div>
              <button className="btn-ghost" onClick={() => { api.logout(); router.push("/login"); }}
                      title="Sign out">
                <ILogOut size={14}/>
                <span className="hidden lg:inline">Sign out</span>
              </button>
            </>
          ) : (
            <Link href="/login" className="btn-primary">
              <ILogIn size={14}/> <span className="hidden xs:inline">Sign in</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
