// Seed a demo room on prod with 10 players + varied collections.
// Usage: BASE=https://coc-swap.vercel.app node scripts/seed-demo.mjs
const BASE = process.env.BASE || "https://coc-swap.vercel.app";
const ADMIN_PIN = "9042";

const PLAYERS = [
  { name: "Ragnar",   pin: "1111" },
  { name: "Astrid",   pin: "2222" },
  { name: "Bjorn",    pin: "3333" },
  { name: "Freya",    pin: "4444" },
  { name: "Loki",     pin: "5555" },
  { name: "Thor",     pin: "6060" },
  { name: "Sigrid",   pin: "7070" },
  { name: "Odin",     pin: "8080" },
  { name: "Ivar",     pin: "1234" },
  { name: "Gunnar",   pin: "4321" },
];

// 60 cards total: 1-19 Elixir, 20-29 Dark, 30-46 Super, 47-60 Builder.
// Cheap: 1-8, 20-22, 30-33, 47-50. Mid: 9-14, 23-26, 34-40, 51-55. Rare: 15-19, 27-29, 41-46, 56-60.
const CHEAP = [1,2,3,4,5,6,7,8,20,21,22,30,31,32,33,47,48,49,50];
const MID   = [9,10,11,12,13,14,23,24,25,26,34,35,36,37,38,39,40,51,52,53,54,55];
const RARE  = [15,16,17,18,19,27,28,29,41,42,43,44,45,46,56,57,58,59,60];

// Deterministic PRNG so re-runs give same layout.
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function collectionFor(idx) {
  const rand = mulberry32(1000 + idx * 37);
  const counts = {};
  // Cheap: mostly 1-3 each, some dupes.
  for (const n of CHEAP) {
    const r = rand();
    if (r < 0.15) continue;              // 15% missing
    else if (r < 0.55) counts[n] = 1;    // 40% single
    else if (r < 0.85) counts[n] = 2;    // 30% dupe
    else counts[n] = 3;                  // 15% triple
  }
  // Mid: some players hoard, some lack.
  for (const n of MID) {
    const r = rand();
    if (r < 0.40) continue;              // 40% missing
    else if (r < 0.80) counts[n] = 1;
    else counts[n] = 2;
  }
  // Rare: scarce, occasional dupe.
  for (const n of RARE) {
    const r = rand();
    if (r < 0.75) continue;              // 75% missing
    else if (r < 0.95) counts[n] = 1;
    else counts[n] = 2;                  // rare dupe = juicy trade
  }
  return counts;
}

async function main() {
  console.log(`→ Creating room on ${BASE} with admin PIN ${ADMIN_PIN}`);
  const jar = new Map(); // per-request Cookie header string is derived from this

  function cookieHeader() {
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  function absorbSetCookie(res) {
    // Node fetch: res.headers.getSetCookie() is available on 20+
    const cookies = typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
    for (const c of cookies) {
      const [pair] = c.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  // Create the room.
  const created = await fetch(`${BASE}/api/room`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ adminPin: ADMIN_PIN }),
  });
  absorbSetCookie(created);
  if (!created.ok) throw new Error(`create room: ${created.status} ${await created.text()}`);
  const { code } = await created.json();
  console.log(`✓ Room created: ${code}`);

  // Save each player.
  for (let i = 0; i < PLAYERS.length; i++) {
    const p = PLAYERS[i];
    const counts = collectionFor(i);
    const res = await fetch(`${BASE}/api/room/${code}/player`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: cookieHeader() },
      body: JSON.stringify({ name: p.name, counts, setPin: p.pin }),
    });
    if (!res.ok) throw new Error(`save ${p.name}: ${res.status} ${await res.text()}`);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const uniq = Object.keys(counts).length;
    console.log(`  ✓ ${p.name.padEnd(8)} pin=${p.pin}  ${uniq} unique / ${total} total`);
  }

  console.log("");
  console.log(`Room:      ${BASE}/r/${code}`);
  console.log(`Admin PIN: ${ADMIN_PIN}`);
  console.log("");
  console.log("Player PINs:");
  for (const p of PLAYERS) console.log(`  ${p.name.padEnd(8)} ${p.pin}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
