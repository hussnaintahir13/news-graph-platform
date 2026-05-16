"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { IGraph, IInfo, ILogIn } from "@/components/Icons";

const PRESETS = [
  { label: "admin",   email: "admin@example.com",   password: "admin1234"   },
  { label: "analyst", email: "analyst@example.com", password: "analyst1234" },
  { label: "user",    email: "user@example.com",    password: "user1234"    },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin1234");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api.login(email, password); router.push("/"); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-md mx-auto mt-12 animate-fade-in">
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-xl2 mx-auto flex items-center justify-center mb-3"
             style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}>
          <IGraph size={22} className="text-white"/>
        </div>
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-sm text-muted mt-1">Sign in to NewroSense — perceptions, context, and details about news.</p>
      </div>

      <div className="card p-6">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs text-muted mb-1">Email</label>
            <input className="input" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {error && (
            <p className="flex items-center gap-2 text-sm text-bad"><IInfo size={14}/> {error}</p>
          )}
          <button className="btn-primary w-full justify-center" disabled={busy}>
            <ILogIn size={14}/> {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="divider my-5"/>

        <div className="text-xs text-muted mb-2">Try a demo account:</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button key={p.email}
                    onClick={() => { setEmail(p.email); setPassword(p.password); }}
                    className="px-3 py-1 rounded-full text-xs bg-slate-100 hover:bg-accent-light/60 hover:text-accent-dark transition">
              {p.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-muted text-center mt-5">
          New here? <Link className="link" href="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
