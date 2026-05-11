"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

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
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16 card p-6">
      <h1 className="text-xl font-semibold">Create an account</h1>
      <form onSubmit={submit} className="space-y-3 mt-4">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input className="input" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Password (min 8 chars)</label>
          <input className="input" type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Role</label>
          <select className="input" value={role} onChange={e => setRole(e.target.value as "user" | "analyst")}>
            <option value="user">User (read-only)</option>
            <option value="analyst">Analyst (watchlists + alerts)</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
      </form>
    </div>
  );
}
