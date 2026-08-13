"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CARDS_BY_CLASS, CLASSES } from "@/lib/catalog";
import type { PlayerCounts } from "@/lib/types";

type RoomState = {
  code: string;
  createdAt: number;
  players: Record<string, { name: string; counts: PlayerCounts; updatedAt: number }>;
};

export default function MePage() {
  const params = useParams<{ code: string }>();
  const code = params.code.toUpperCase();
  const router = useRouter();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [name, setName] = useState<string>("");
  const [nameLocked, setNameLocked] = useState(false);
  const [counts, setCounts] = useState<PlayerCounts>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetch(`/api/room/${code}`);
      if (r.status === 403) { router.push("/"); return; }
      const d = await r.json();
      if (alive) setRoom(d);
    })();
    return () => { alive = false; };
  }, [code, router]);

  useEffect(() => {
    if (!name || !nameLocked || !room) return;
    const existing = room.players[name];
    if (existing) setCounts(existing.counts);
  }, [name, nameLocked, room]);

  function cycle(num: number) {
    setCounts((c) => {
      const cur = c[num] ?? 0;
      const next = cur >= 5 ? 0 : cur + 1;
      const copy = { ...c };
      if (next === 0) delete copy[num];
      else copy[num] = next;
      return copy;
    });
  }

  async function save() {
    if (!name.trim()) { setErr("pick a name"); return; }
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/room/${code}/player`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), counts }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "failed");
      router.push(`/r/${code}`);
    } catch (e: any) { setErr(String(e.message || e)); }
    finally { setSaving(false); }
  }

  if (!room) return <p className="text-center opacity-60">Loading…</p>;

  const existingNames = Object.keys(room.players);

  return (
    <main className="space-y-6">
      <nav className="flex items-center justify-between">
        <button onClick={() => router.push(`/r/${code}`)} className="opacity-60 hover:opacity-100">← Room</button>
        <span className="font-mono text-clan-accent">{code}</span>
      </nav>

      <section className="bg-clan-card rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold">Who are you?</h2>
        {!nameLocked ? (
          <div className="space-y-3">
            {existingNames.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {existingNames.map((n) => (
                  <button key={n} onClick={() => { setName(n); setNameLocked(true); }} className="px-3 py-2 rounded bg-black/40 hover:bg-clan-accent hover:text-black">
                    {n}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New name" maxLength={40} className="flex-1 bg-black/40 rounded p-2 outline-none border border-white/10 focus:border-clan-accent" />
              <button disabled={!name.trim()} onClick={() => setNameLocked(true)} className="px-4 py-2 bg-clan-accent text-black font-bold rounded disabled:opacity-40">Use</button>
            </div>
            <p className="text-xs opacity-50">Anyone in this room can edit anyone&apos;s cards. Trust your clan.</p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-clan-accent font-semibold">{name}</span>
            <button onClick={() => { setNameLocked(false); setCounts({}); }} className="text-xs opacity-60 underline">Switch</button>
          </div>
        )}
      </section>

      {nameLocked && (
        <>
          <p className="text-sm opacity-70 text-center">Tap a card to cycle: 0 → 1 → 2 → 3 → 4 → 5 → 0. Number = copies you own.</p>
          {CLASSES.map((cls) => (
            <section key={cls} className="space-y-2">
              <h3 className="text-lg font-semibold text-clan-accent">{cls}</h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {CARDS_BY_CLASS[cls].map((card) => {
                  const cnt = counts[card.number] ?? 0;
                  return (
                    <button key={card.number} onClick={() => cycle(card.number)} className={`card-tile ${cnt === 0 ? "missing" : ""} ${cnt >= 2 ? "dupe" : ""}`} title={card.name}>
                      <img src={card.icon} alt={card.name} />
                      {cnt > 0 && <span className="badge">{cnt}</span>}
                      <span className="name">{card.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          <div className="sticky bottom-4 bg-clan-card/95 backdrop-blur rounded-xl p-3 flex items-center justify-between gap-3 border border-clan-accent/40 shadow-lg">
            <span className="text-sm opacity-70">Saving as <span className="text-clan-accent font-semibold">{name}</span></span>
            <button disabled={saving} onClick={save} className="px-4 py-2 bg-clan-accent text-black font-bold rounded disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          {err && <p className="text-red-400 text-center">{err}</p>}
        </>
      )}
    </main>
  );
}
