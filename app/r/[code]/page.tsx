"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CARDS_BY_CLASS, CLASSES, CARD_BY_NUM, type CardClass } from "@/lib/catalog";
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

export default function Room() {
  const params = useParams<{ code: string }>();
  const code = params.code.toUpperCase();
  const router = useRouter();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [trades, setTrades] = useState<Trades | null>(null);
  const [tab, setTab] = useState<Tab>("trades");
  const [notFound, setNotFound] = useState(false);

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

  if (notFound) return (
    <main className="text-center space-y-4 py-12">
      <h2 className="text-2xl">Room not found</h2>
      <button onClick={() => router.push("/")} className="px-4 py-2 bg-clan-accent text-black rounded">Home</button>
    </main>
  );
  if (!room) return <p className="text-center opacity-60 py-12">Loading…</p>;

  const memberNames = Object.keys(room.players);

  return (
    <main className="space-y-4">
      <header className="flex items-center justify-between">
        <button onClick={() => router.push("/")} className="opacity-60 hover:opacity-100 text-sm">← Home</button>
        <div className="text-right">
          <div className="text-xs opacity-60">Room</div>
          <div className="font-mono text-xl text-clan-accent font-bold tracking-widest">{code}</div>
        </div>
      </header>

      <div className="flex items-center gap-2">
        <button onClick={() => router.push(`/r/${code}/me`)} className="flex-1 py-3 rounded bg-clan-accent text-black font-bold">
          Edit my cards
        </button>
        <button onClick={() => { navigator.clipboard.writeText(code); }} className="px-4 py-3 bg-black/40 rounded" title="Copy code">📋</button>
      </div>

      <nav className="flex gap-1 border-b border-white/10">
        {(["trades", "members", "catalog"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm capitalize ${tab === t ? "text-clan-accent border-b-2 border-clan-accent -mb-px" : "opacity-60"}`}>
            {t}
          </button>
        ))}
      </nav>

      {tab === "trades" && <TradesTab trades={trades} memberCount={memberNames.length} />}
      {tab === "members" && <MembersTab room={room} trades={trades} />}
      {tab === "catalog" && <CatalogTab />}
    </main>
  );
}

function TradesTab({ trades, memberCount }: { trades: Trades | null; memberCount: number }) {
  if (memberCount === 0) return <p className="opacity-60 py-6 text-center">No one has filled cards yet. Be the first — tap &quot;Edit my cards&quot;.</p>;
  if (!trades) return <p className="opacity-60 py-6 text-center">Computing…</p>;
  const total = trades.reciprocal.length + trades.oneSided.length;
  if (total === 0) return <p className="opacity-60 py-6 text-center">No trades available yet. Add more clanmates or duplicates.</p>;

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
    <div className="space-y-6">
      <button onClick={summary} className="w-full py-2 bg-black/40 rounded text-sm hover:bg-black/60">📋 Copy to clipboard for clan chat</button>

      {trades.reciprocal.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-clan-accent mb-2">Direct swaps ({trades.reciprocal.length})</h3>
          <p className="text-xs opacity-60 mb-3">Both parties get a card they need.</p>
          <div className="space-y-2">
            {trades.reciprocal.map((s, i) => (
              <div key={i} className="bg-clan-card rounded-lg p-3 flex items-center gap-3">
                <TradeCard num={s.cardNumber} name={s.cardName} />
                <div className="flex-1 text-sm">
                  <div><span className="font-semibold text-clan-accent">{s.from}</span> → <span className="font-semibold">{s.to}</span></div>
                  <div className="opacity-60 text-xs">{s.class}</div>
                </div>
                <div className="opacity-50">↔</div>
                <div className="flex-1 text-sm text-right">
                  <div><span className="font-semibold">{s.from}</span> ← <span className="font-semibold text-clan-accent">{s.to}</span></div>
                </div>
                <TradeCard num={s.reciprocal!.cardNumber} name={s.reciprocal!.cardName} />
              </div>
            ))}
          </div>
        </section>
      )}

      {trades.oneSided.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-clan-accent mb-2">Asks ({trades.oneSided.length})</h3>
          <p className="text-xs opacity-60 mb-3">One-way: recipient may already have the card (accepting is still allowed).</p>
          <div className="space-y-2">
            {trades.oneSided.map((s, i) => (
              <div key={i} className="bg-clan-card rounded-lg p-3 flex items-center gap-3">
                <TradeCard num={s.cardNumber} name={s.cardName} />
                <div className="flex-1 text-sm">
                  <div><span className="font-semibold">{s.to}</span> needs → ask <span className="font-semibold text-clan-accent">{s.from}</span></div>
                  <div className="opacity-60 text-xs">{s.class}</div>
                </div>
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
    <div className="card-tile w-14 h-16 flex-shrink-0">
      <img src={c.icon} alt={name} />
    </div>
  );
}

function MembersTab({ room, trades }: { room: RoomState; trades: Trades | null }) {
  const names = Object.keys(room.players);
  if (names.length === 0) return <p className="opacity-60 py-6 text-center">Nobody here yet.</p>;
  return (
    <div className="space-y-3">
      {names.map((n) => {
        const p = room.players[n];
        const stats = trades?.stats[n] || [];
        return (
          <div key={n} className="bg-clan-card rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-clan-accent">{n}</span>
              <span className="text-xs opacity-50">updated {relTime(p.updatedAt)}</span>
            </div>
            {stats.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                {stats.map((s, i) => (
                  <div key={i} className="bg-black/30 rounded p-2">
                    <div className="opacity-60">{CLASSES[i]}</div>
                    <div className="font-mono">{s.got}/{s.total}</div>
                    <div className="h-1 bg-black/40 rounded mt-1 overflow-hidden">
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
    <div className="space-y-6">
      {CLASSES.map((cls) => (
        <section key={cls}>
          <h3 className="text-lg font-semibold text-clan-accent mb-2">{cls} ({CARDS_BY_CLASS[cls].length})</h3>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {CARDS_BY_CLASS[cls].map((card) => (
              <div key={card.number} className="card-tile" title={card.name}>
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
