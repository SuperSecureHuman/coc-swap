"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CARDS_BY_CLASS, CLASSES, CARD_BY_NUM, tierClass, type CardClass } from "@/lib/catalog";
import type { PlayerCounts } from "@/lib/types";

type RoomState = {
  code: string;
  createdAt: number;
  players: Record<string, { name: string; counts: PlayerCounts; updatedAt: number }>;
};

type TradeSuggestion = {
  from: string; to: string; cardNumber: number; cardName: string; class: CardClass;
  reciprocal?: { cardNumber: number; cardName: string }; priority: number;
};

type Trades = {
  reciprocal: TradeSuggestion[];
  oneSided: TradeSuggestion[];
  stats: Record<string, { got: number; total: number }[]>;
};

type Tab = "trades" | "members" | "catalog";

const PIN_STORAGE_PREFIX = "coc-admin-pin:";

export default function Room() {
  const params = useParams<{ code: string }>();
  const code = params.code.toUpperCase();
  const router = useRouter();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [trades, setTrades] = useState<Trades | null>(null);
  const [tab, setTab] = useState<Tab>("trades");
  const [notFound, setNotFound] = useState(false);
  const [adminPin, setAdminPin] = useState<string | null>(null);
  const [adminModal, setAdminModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAdminPin(sessionStorage.getItem(PIN_STORAGE_PREFIX + code));
    }
  }, [code]);

  async function refresh() {
    const r = await fetch(`/api/room/${code}`);
    if (r.status === 403) { router.push("/"); return; }
    if (r.status === 404) { setNotFound(true); return; }
    setRoom(await r.json());
    const t = await fetch(`/api/room/${code}/trades`);
    if (t.ok) setTrades(await t.json());
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [code]);

  async function completeTrade(s: TradeSuggestion) {
    const body: Record<string, unknown> = { from: s.from, to: s.to, cardNumber: s.cardNumber };
    if (s.reciprocal) body.reciprocalCardNumber = s.reciprocal.cardNumber;
    await fetch(`/api/room/${code}/trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await refresh();
  }

  async function kickPlayer(name: string) {
    if (!adminPin) { setAdminModal(true); return; }
    if (!confirm(`Kick ${name} from the room? Their cards are wiped.`)) return;
    const r = await fetch(`/api/room/${code}/player?name=${encodeURIComponent(name)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPin }),
    });
    if (r.status === 403) {
      sessionStorage.removeItem(PIN_STORAGE_PREFIX + code);
      setAdminPin(null);
      alert("PIN rejected");
      return;
    }
    await refresh();
  }

  async function deleteRoom() {
    if (!adminPin) { setAdminModal(true); return; }
    if (!confirm("Delete this room permanently? All cards are wiped.")) return;
    const r = await fetch(`/api/room/${code}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPin }),
    });
    if (r.status === 403) {
      sessionStorage.removeItem(PIN_STORAGE_PREFIX + code);
      setAdminPin(null);
      alert("PIN rejected");
      return;
    }
    if (r.ok) router.push("/");
  }

  function saveAdminPin(pin: string) {
    sessionStorage.setItem(PIN_STORAGE_PREFIX + code, pin);
    setAdminPin(pin);
    setAdminModal(false);
  }
  function clearAdminPin() {
    sessionStorage.removeItem(PIN_STORAGE_PREFIX + code);
    setAdminPin(null);
  }

  if (notFound) return (
    <main className="text-center space-y-4 py-16 animate-fade-in">
      <h2 className="text-2xl">Room not found</h2>
      <button onClick={() => router.push("/")} className="btn-primary">Home</button>
    </main>
  );
  if (!room) return <p className="text-center text-zinc-500 py-16">Loading…</p>;

  const memberNames = Object.keys(room.players);

  return (
    <main className="space-y-5 animate-fade-in">
      <header className="flex items-center justify-between">
        <button onClick={() => router.push("/")} className="btn-ghost text-sm">← Home</button>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Room</div>
          <div className="font-mono text-xl text-clan-accent font-bold tracking-widest">{code}</div>
        </div>
      </header>

      <div className="flex items-center gap-2">
        <button onClick={() => router.push(`/r/${code}/me`)} className="btn-primary flex-1 py-3">
          Edit my cards
        </button>
        <button onClick={() => navigator.clipboard.writeText(code)} className="btn-secondary px-3" title="Copy code">📋</button>
        <button
          onClick={() => adminPin ? clearAdminPin() : setAdminModal(true)}
          className={`btn-secondary px-3 ${adminPin ? "border-clan-accent text-clan-accent" : ""}`}
          title={adminPin ? "Admin unlocked · click to lock" : "Enter admin PIN"}
        >
          {adminPin ? "🔓" : "🔒"}
        </button>
      </div>

      <nav className="flex gap-1 border-b border-zinc-800">
        {(["trades", "members", "catalog"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm capitalize transition ${tab === t ? "text-clan-accent border-b-2 border-clan-accent -mb-px font-semibold" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "trades" && <TradesTab trades={trades} memberCount={memberNames.length} onDone={completeTrade} />}
      {tab === "members" && <MembersTab room={room} trades={trades} isAdmin={!!adminPin} onKick={kickPlayer} />}
      {tab === "catalog" && <CatalogTab />}

      {adminPin && (
        <section className="card p-4 border-red-800/60 animate-fade-up">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-red-400 text-sm font-semibold">Danger zone</p>
              <p className="text-xs text-zinc-500">Deleting the room removes all players and cards.</p>
            </div>
            <button onClick={deleteRoom} className="btn-danger text-sm">Delete room</button>
          </div>
        </section>
      )}

      {adminModal && <AdminPinModal onCancel={() => setAdminModal(false)} onSubmit={saveAdminPin} />}
    </main>
  );
}

function AdminPinModal({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="card p-6 w-full max-w-sm space-y-4 animate-fade-up">
        <div>
          <h3 className="text-lg font-semibold">Admin PIN</h3>
          <p className="text-xs text-zinc-500 mt-1">Enter the 4-digit PIN from when the room was created.</p>
        </div>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
          placeholder="••••"
          inputMode="numeric"
          autoFocus
          className="input text-2xl font-mono tracking-widest text-center"
        />
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button disabled={pin.length !== 4} onClick={() => onSubmit(pin)} className="btn-primary flex-1">Unlock</button>
        </div>
        <p className="text-[10px] text-zinc-500">The PIN is stored only in this browser session.</p>
      </div>
    </div>
  );
}

function TradesTab({ trades, memberCount, onDone }: { trades: Trades | null; memberCount: number; onDone: (s: TradeSuggestion) => void | Promise<void> }) {
  if (memberCount === 0) return <p className="text-zinc-500 py-8 text-center">No one has filled cards yet. Be the first — tap “Edit my cards”.</p>;
  if (!trades) return <p className="text-zinc-500 py-8 text-center">Computing…</p>;
  const total = trades.reciprocal.length + trades.oneSided.length;
  if (total === 0) return <p className="text-zinc-500 py-8 text-center">No trades available yet. Add more clanmates or duplicates.</p>;

  function summary() {
    const lines = ["🔁 Clash of Cards trades:", ""];
    if (trades!.reciprocal.length) {
      lines.push("Direct swaps:");
      for (const s of trades!.reciprocal) lines.push(`• ${s.from} ↔ ${s.to}: ${s.cardName} for ${s.reciprocal!.cardName} (${s.class})`);
      lines.push("");
    }
    if (trades!.oneSided.length) {
      lines.push("Asks:");
      for (const s of trades!.oneSided) lines.push(`• ${s.to} needs ${s.cardName} → ask ${s.from} (${s.class})`);
    }
    navigator.clipboard.writeText(lines.join("\n"));
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <button onClick={summary} className="btn-secondary w-full text-sm">📋 Copy for clan chat</button>

      {trades.reciprocal.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-clan-accent mb-1">Direct swaps <span className="text-zinc-500 font-normal">({trades.reciprocal.length})</span></h3>
          <p className="text-xs text-zinc-500 mb-3">Both parties get a card they need.</p>
          <div className="space-y-2">
            {trades.reciprocal.map((s, i) => (
              <div key={i} className="card p-3 flex items-center gap-3">
                <TradeCard num={s.cardNumber} name={s.cardName} />
                <div className="flex-1 text-sm min-w-0">
                  <div className="truncate"><span className="font-semibold text-clan-accent">{s.from}</span> → <span className="font-semibold">{s.to}</span></div>
                  <div className="text-zinc-500 text-xs">{s.class}</div>
                </div>
                <div className="text-zinc-600">↔</div>
                <div className="flex-1 text-sm text-right min-w-0">
                  <div className="truncate"><span className="font-semibold">{s.from}</span> ← <span className="font-semibold text-clan-accent">{s.to}</span></div>
                </div>
                <TradeCard num={s.reciprocal!.cardNumber} name={s.reciprocal!.cardName} />
                <DoneButton onClick={() => onDone(s)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {trades.oneSided.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-clan-accent mb-1">Asks <span className="text-zinc-500 font-normal">({trades.oneSided.length})</span></h3>
          <p className="text-xs text-zinc-500 mb-3">One-way. Accepter may already own the card — that&apos;s allowed.</p>
          <div className="space-y-2">
            {trades.oneSided.map((s, i) => (
              <div key={i} className="card p-3 flex items-center gap-3">
                <TradeCard num={s.cardNumber} name={s.cardName} />
                <div className="flex-1 text-sm min-w-0">
                  <div className="truncate"><span className="font-semibold">{s.to}</span> needs → ask <span className="font-semibold text-clan-accent">{s.from}</span></div>
                  <div className="text-zinc-500 text-xs">{s.class}</div>
                </div>
                <DoneButton onClick={() => onDone(s)} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TradeCard({ num, name }: { num: number; name: string }) {
  const c = CARD_BY_NUM[num];
  if (!c) return null;
  return (
    <div className={`card-tile ${tierClass(c)} w-14 h-16 flex-shrink-0`}>
      <img src={c.icon} alt={name} />
    </div>
  );
}

function DoneButton({ onClick }: { onClick: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try { await onClick(); } finally { setBusy(false); }
      }}
      disabled={busy}
      className="btn-primary px-3 py-2 text-xs flex-shrink-0"
      title="Mark this trade as completed"
    >
      {busy ? "…" : "Done ✓"}
    </button>
  );
}

function MembersTab({ room, trades, isAdmin, onKick }: {
  room: RoomState;
  trades: Trades | null;
  isAdmin: boolean;
  onKick: (name: string) => void | Promise<void>;
}) {
  const names = Object.keys(room.players);
  if (names.length === 0) return <p className="text-zinc-500 py-8 text-center">Nobody here yet.</p>;
  return (
    <div className="space-y-3 animate-fade-up">
      {names.map((n) => {
        const p = room.players[n];
        const stats = trades?.stats[n] || [];
        return (
          <div key={n} className="card p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-clan-accent">{n}</span>
                <span className="text-xs text-zinc-500 ml-2">updated {relTime(p.updatedAt)}</span>
              </div>
              {isAdmin && (
                <button onClick={() => onKick(n)} className="text-xs text-red-400 hover:text-red-300 border border-red-900/50 rounded px-2 py-1">
                  Kick
                </button>
              )}
            </div>
            {stats.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                {stats.map((s, i) => (
                  <div key={i} className="bg-zinc-950 border border-zinc-800 rounded p-2">
                    <div className="text-zinc-500">{CLASSES[i]}</div>
                    <div className="font-mono">{s.got}/{s.total}</div>
                    <div className="h-1 bg-zinc-800 rounded mt-1 overflow-hidden">
                      <div className="h-full bg-clan-accent" style={{ width: `${(s.got / s.total) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CatalogTab() {
  return (
    <div className="space-y-6 animate-fade-up">
      {CLASSES.map((cls) => (
        <section key={cls}>
          <h3 className="text-lg font-semibold text-clan-accent mb-2">{cls} <span className="text-zinc-500 font-normal text-sm">({CARDS_BY_CLASS[cls].length})</span></h3>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {CARDS_BY_CLASS[cls].map((card) => (
              <div key={card.number} className={`card-tile ${tierClass(card)}`} title={`${card.name} · ${card.gemCost} gems`}>
                <img src={card.icon} alt={card.name} />
                <span className="name">{card.name}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function relTime(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
