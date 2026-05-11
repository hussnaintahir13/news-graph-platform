"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { IGraph, IInfo, IUser } from "@/components/Icons";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "analyst">("user");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.register(email, password, role);
      await api.login(email, password);
      router.push("/");
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-md mx-auto mt-12 animate-fade-in">
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-xl2 mx-auto flex items-center justify-center mb-3"
             style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}>
          <IGraph size={22} className="text-white"/>
        </div>
        <h1 className="text-2xl font-bold">Create an account</h1>
        <p className="text-sm text-muted mt-1">No email verification — accounts work immediately.</p>
      </div>

      <div className="card p-6">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs text-muted mb-1">Email</label>
            <input className="input" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Password <span className="text-muted">(min 8 chars)</span></label>
            <input className="input" type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Role</label>
            <div className="grid grid-cols-2 gap-2">
              <RoleButton selected={role === "user"} onClick={() => setRole("user")}
                          title="User" subtitle="Read-only — explore graph, articles, search & AI."/>
              <RoleButton selected={role === "analyst"} onClick={() => setRole("analyst")}
                          title="Analyst" subtitle="Same as user + watchlists & alerts."/>
            </div>
          </div>
          {error && <p className="flex items-center gap-2 text-sm text-bad"><IInfo size={14}/> {error}</p>}
          <button className="btn-primary w-full justify-center" disabled={busy}>
            <IUser size={14}/> {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="text-xs text-muted text-center mt-5">
          Already have an account? <Link className="link" href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

function RoleButton({ selected, onClick, title, subtitle }: { selected: boolean; onClick: () => void; title: string; subtitle: string }) {
  return (
    <button type="button" onClick={onClick}
            className={"text-left p-3 rounded-lg border transition " +
              (selected ? "border-accent bg-accent-light/40" : "border-slate-200 hover:border-accent")}>
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-muted mt-0.5">{subtitle}</div>
    </button>
  );
}
