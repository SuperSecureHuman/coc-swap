"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ code: string; adminPin: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/room", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "failed");
      setCreated(d);
    } catch (e: any) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  }

  async function join() {
    setBusy(true); setErr(null);
    try {
      const code = joinCode.trim().toUpperCase();
      if (!code) throw new Error("enter a code");
      const r = await fetch(`/api/room/${code}`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "failed");
      router.push(`/r/${code}`);
    } catch (e: any) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  }

  return (
    <main className="space-y-10 animate-fade-in">
      <header className="text-center py-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-clan-accent tracking-tight">Clan Swap</h1>
        <p className="text-zinc-400 mt-3 text-sm">Trade planner for Clash of Cards.</p>
      </header>

      {created ? (
        <section className="card p-6 space-y-4 border-clan-accent/40 animate-fade-up max-w-lg mx-auto">
          <h2 className="text-xl font-semibold text-clan-accent">Room created</h2>
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Share code</p>
            <div className="text-3xl font-mono font-bold tracking-widest text-clan-accent bg-zinc-950 rounded-md p-3 text-center border border-zinc-800">
              {created.code}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Admin PIN — save it, shown once</p>
            <div className="text-2xl font-mono font-bold tracking-widest bg-zinc-950 rounded-md p-3 text-center border border-zinc-800">
              {created.adminPin}
            </div>
          </div>
          <button className="btn-primary w-full" onClick={() => router.push(`/r/${created.code}`)}>
            Enter room →
          </button>
        </section>
      ) : (
        <section className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
          <div className="card p-6 space-y-4 animate-fade-up">
            <h2 className="text-xl font-semibold">Create a room</h2>
            <p className="text-zinc-400 text-sm">Get a shareable code and an admin PIN.</p>
            <button disabled={busy} onClick={create} className="btn-primary w-full">
              {busy ? "Working…" : "Create room"}
            </button>
          </div>
          <div className="card p-6 space-y-4 animate-fade-up">
            <h2 className="text-xl font-semibold">Join a room</h2>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={8}
              className="input text-xl font-mono tracking-widest text-center"
            />
            <button disabled={busy || !joinCode.trim()} onClick={join} className="btn-primary w-full">
              {busy ? "Joining…" : "Join"}
            </button>
          </div>
        </section>
      )}
      {err && <p className="text-red-400 text-center text-sm">{err}</p>}
      <footer className="text-center text-zinc-500 text-xs pt-8">Ephemeral · rooms auto-expire in 90 days.</footer>
    </main>
  );
}
