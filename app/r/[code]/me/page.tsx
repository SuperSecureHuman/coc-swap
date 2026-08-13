"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CARDS_BY_CLASS, CLASSES, reorderForPicker, tierClass } from "@/lib/catalog";
import type { PlayerCounts } from "@/lib/types";

type RoomState = {
  code: string;
  createdAt: number;
  players: Record<string, { name: string; counts: PlayerCounts; updatedAt: number }>;
};

const PIN_STORAGE_PREFIX = "coc-player-pin:"; // per (room, name)
const NAME_RE = /^[A-Za-z0-9 _-]{1,20}$/;
const PIN_RE = /^\d{4}$/;

function pinKey(code: string, name: string) {
  return `${PIN_STORAGE_PREFIX}${code}:${name}`;
}

export default function MePage() {
  const params = useParams<{ code: string }>();
  const code = params.code.toUpperCase();
  const router = useRouter();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [name, setName] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [pinConfirm, setPinConfirm] = useState<string>(""); // for first-claim flow only
  const [isFirstClaim, setIsFirstClaim] = useState(false);
  const [nameLocked, setNameLocked] = useState(false);
  const [counts, setCounts] = useState<PlayerCounts>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pinErr, setPinErr] = useState<string | null>(null);

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

  function selectName(chosen: string) {
    if (!NAME_RE.test(chosen)) { setErr("Name: 1-20 chars, letters/digits/space/_/-"); return; }
    setErr(null);
    setName(chosen);
    const isNew = !room?.players[chosen];
    setIsFirstClaim(isNew);
    const stashed = typeof window !== "undefined" ? localStorage.getItem(pinKey(code, chosen)) : null;
    if (stashed && !isNew) setPin(stashed);
    else setPin("");
    setPinConfirm("");
    setNameLocked(true);
  }

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
    setErr(null); setPinErr(null);
    if (!name.trim()) { setErr("pick a name"); return; }
    if (!PIN_RE.test(pin)) { setPinErr("PIN must be 4 digits"); scrollToTop(); return; }
    if (isFirstClaim && pin !== pinConfirm) { setPinErr("PINs don't match"); scrollToTop(); return; }
    setSaving(true);
    try {
      const body: any = { name: name.trim(), counts };
      if (isFirstClaim) body.setPin = pin;
      else body.pin = pin;
      const r = await fetch(`/api/room/${code}/player`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 429) {
        setPinErr(`Too many attempts. Try again in ${d.retryAfterSec ?? 60}s.`);
        scrollToTop();
        return;
      }
      if (r.status === 403) {
        setPin("");
        if (typeof window !== "undefined") localStorage.removeItem(pinKey(code, name.trim()));
        setPinErr("Wrong PIN. Your cards are safe — re-enter the PIN and save again.");
        scrollToTop();
        return;
      }
      if (r.status === 409) {
        setIsFirstClaim(false);
        setPin("");
        setPinErr("Name was just claimed. Enter its PIN, or pick another name.");
        scrollToTop();
        return;
      }
      if (!r.ok) { setErr(d.error || "failed"); return; }
      if (typeof window !== "undefined") localStorage.setItem(pinKey(code, name.trim()), pin);
      router.push(`/r/${code}`);
    } catch (e: any) {
      setErr(String(e.message || e));
    } finally { setSaving(false); }
  }

  function scrollToTop() {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!room) return <p className="text-center opacity-60">Loading…</p>;

  const existingNames = Object.keys(room.players);

  return (
    <main className="space-y-6 animate-fade-in">
      <nav className="flex items-center justify-between">
        <button onClick={() => router.push(`/r/${code}`)} className="btn-ghost text-sm">← Room</button>
        <span className="font-mono text-clan-accent tracking-widest">{code}</span>
      </nav>

      <section className="card p-5 space-y-3">
        <h2 className="text-lg font-semibold">Who are you?</h2>
        {!nameLocked ? (
          <div className="space-y-3">
            {existingNames.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Continue as</p>
                <div className="flex flex-wrap gap-2">
                  {existingNames.map((n) => (
                    <button key={n} onClick={() => selectName(n)} className="btn-secondary">
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Or new name</p>
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9 _-]/g, "").slice(0, 20))}
                  placeholder="Name (letters/digits/space/_/-)"
                  maxLength={20}
                  className="input"
                />
                <button disabled={!name.trim() || !NAME_RE.test(name.trim())} onClick={() => selectName(name.trim())} className="btn-primary">Use</button>
              </div>
            </div>
            <p className="text-xs text-zinc-500">You&apos;ll set a 4-digit PIN on first save. Same PIN unlocks future edits from any device.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-clan-accent font-semibold">{name}</span>
              <button onClick={() => { setNameLocked(false); setCounts({}); setPin(""); setPinConfirm(""); }} className="text-xs text-zinc-400 underline hover:text-zinc-100">Switch</button>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-zinc-500 block">
                {isFirstClaim ? "Set a 4-digit PIN (save it, protects your slot)" : "Enter your PIN"}
              </label>
              <input
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4)); setPinErr(null); }}
                placeholder="••••"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="input text-2xl font-mono tracking-widest text-center max-w-[10rem] mx-auto"
              />
              {isFirstClaim && (
                <input
                  value={pinConfirm}
                  onChange={(e) => { setPinConfirm(e.target.value.replace(/[^0-9]/g, "").slice(0, 4)); setPinErr(null); }}
                  placeholder="Confirm PIN"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="input text-2xl font-mono tracking-widest text-center max-w-[10rem] mx-auto"
                />
              )}
              {pinErr && (
                <p className="text-red-400 text-sm text-center bg-red-950/50 border border-red-900 rounded-md py-2 px-3">
                  ⚠ {pinErr}
                </p>
              )}
              {!isFirstClaim && !pinErr && (
                <p className="text-xs text-zinc-500 text-center">Forgot your PIN? Ask the room admin to kick your slot so you can reclaim the name.</p>
              )}
            </div>
          </div>
        )}
      </section>

      {nameLocked && (
        <>
          <p className="text-sm text-zinc-400 text-center">Tap a card to cycle: 0 → 1 → 2 → 3 → 4 → 5 → 0. Number = copies you own.</p>
          {CLASSES.map((cls) => (
            <section key={cls} className="space-y-2 animate-fade-up">
              <h3 className="text-lg font-semibold text-clan-accent">{cls}</h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {reorderForPicker(CARDS_BY_CLASS[cls], 8).map((card) => {
                  const cnt = counts[card.number] ?? 0;
                  return (
                    <button key={card.number} onClick={() => cycle(card.number)} className={`card-tile ${tierClass(card)} ${cnt === 0 ? "missing" : ""} ${cnt >= 2 ? "dupe" : ""}`} title={card.name}>
                      <img src={card.icon} alt={card.name} />
                      {cnt > 0 && <span className="badge">{cnt}</span>}
                      <span className="name">{card.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          <div className={`sticky bottom-4 card p-3 flex items-center justify-between gap-3 shadow-lg backdrop-blur bg-clan-card/95 ${pinErr ? "border-red-500" : "border-clan-accent/40"}`}>
            <div className="min-w-0">
              <div className="text-sm text-zinc-400 truncate">Saving as <span className="text-clan-accent font-semibold">{name}</span></div>
              {pinErr && <div className="text-xs text-red-400 truncate">⚠ {pinErr}</div>}
            </div>
            <button disabled={saving || !PIN_RE.test(pin)} onClick={save} className="btn-primary flex-shrink-0">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          {err && <p className="text-red-400 text-center text-sm">{err}</p>}
        </>
      )}
    </main>
  );
}
