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
    <main className="space-y-8">
      <header className="text-center py-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-clan-accent">Clan Swap</h1>
        <p className="opacity-70 mt-2">Trade planner for Clash of Cards.</p>
      </header>

      {created ? (
        <section className="bg-clan-card rounded-xl p-6 space-y-3 border border-clan-accent/40">
          <h2 className="text-xl font-semibold text-clan-accent">Room created!</h2>
          <p>Share this code with your clan:</p>
          <div className="text-3xl font-mono font-bold tracking-widest text-clan-accent bg-black/40 rounded p-3 text-center">{created.code}</div>
          <p>Admin PIN (save it — only shown once):</p>
          <div className="text-2xl font-mono font-bold tracking-widest bg-black/40 rounded p-3 text-center">{created.adminPin}</div>
          <button className="w-full bg-clan-accent text-black font-bold rounded py-3 mt-2" onClick={() => router.push(`/r/${created.code}`)}>
            Enter room →
          </button>
        </section>
      ) : (
        <section className="grid gap-6 sm:grid-cols-2">
          <div className="bg-clan-card rounded-xl p-6 space-y-3 border border-white/5">
            <h2 className="text-xl font-semibold">Create a room</h2>
            <p className="opacity-70 text-sm">Get a shareable code + admin PIN.</p>
            <button disabled={busy} onClick={create} className="w-full bg-clan-accent text-black font-bold rounded py-3 disabled:opacity-50">
              {busy ? "Working…" : "Create room"}
            </button>
          </div>
          <div className="bg-clan-card rounded-xl p-6 space-y-3 border border-white/5">
            <h2 className="text-xl font-semibold">Join a room</h2>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={8}
              className="w-full bg-black/40 rounded p-3 text-xl font-mono tracking-widest text-center outline-none border border-white/10 focus:border-clan-accent"
            />
            <button disabled={busy || !joinCode.trim()} onClick={join} className="w-full bg-clan-accent text-black font-bold rounded py-3 disabled:opacity-50">
              {busy ? "Joining…" : "Join"}
            </button>
          </div>
        </section>
      )}
      {err && <p className="text-red-400 text-center">{err}</p>}
      <footer className="text-center opacity-40 text-xs pt-8">Ephemeral · rooms auto-expire in 30 days.</footer>
    </main>
  );
}
