import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { PlayerCounts, Room } from "./types";

// Neon HTTP driver — lazy init so build-time (or missing env) doesn't blow up.
let _sql: NeonQueryFunction<false, false> | null = null;
function db(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  _sql = neon(url);
  return _sql;
}
// Proxy so existing `sql\`...\`` tagged calls forward to the lazy client.
export const sql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
  (db() as any)(strings, ...values)) as NeonQueryFunction<false, false>;
(sql as any).query = (q: string, params?: unknown[]) => (db() as any).query(q, params);

export async function getRoom(code: string): Promise<Room | null> {
  code = code.toUpperCase();
  const rows = await sql`
    SELECT code, admin_pin_hash, salt,
           EXTRACT(EPOCH FROM created_at)::bigint * 1000 AS created_at_ms
    FROM rooms WHERE code = ${code} LIMIT 1
  ` as any[];
  if (rows.length === 0) return null;
  const r = rows[0];

  const playerRows = await sql`
    SELECT name, counts,
           EXTRACT(EPOCH FROM updated_at)::bigint * 1000 AS updated_at_ms
    FROM players WHERE room_code = ${code}
  ` as any[];

  const players: Record<string, Room["players"][string]> = {};
  for (const p of playerRows) {
    players[p.name] = {
      name: p.name,
      counts: (p.counts ?? {}) as PlayerCounts,
      updatedAt: Number(p.updated_at_ms),
    };
  }

  return {
    code: r.code,
    adminPinHash: r.admin_pin_hash,
    salt: r.salt,
    createdAt: Number(r.created_at_ms),
    players,
  };
}

export async function createRoom(room: {
  code: string;
  adminPinHash: string;
  salt: string;
}): Promise<void> {
  await sql`
    INSERT INTO rooms (code, admin_pin_hash, salt)
    VALUES (${room.code}, ${room.adminPinHash}, ${room.salt})
  `;
}

export async function upsertPlayer(
  code: string,
  name: string,
  counts: PlayerCounts,
): Promise<void> {
  await sql`
    INSERT INTO players (room_code, name, counts, updated_at)
    VALUES (${code.toUpperCase()}, ${name}, ${JSON.stringify(counts)}::jsonb, NOW())
    ON CONFLICT (room_code, name)
    DO UPDATE SET counts = EXCLUDED.counts, updated_at = NOW()
  `;
}

// Fetch a player's PIN hash. Returns null if player doesn't exist yet, or has no PIN.
export async function getPlayerPin(code: string, name: string): Promise<{ hash: string; salt: string } | null> {
  const rows = await sql`
    SELECT pin_hash, pin_salt FROM players
    WHERE room_code = ${code.toUpperCase()} AND name = ${name} LIMIT 1
  ` as any[];
  if (rows.length === 0) return null;
  const r = rows[0];
  if (!r.pin_hash || !r.pin_salt) return null;
  return { hash: r.pin_hash, salt: r.pin_salt };
}

// Set the PIN on a player (first-time claim). Fails if a PIN is already set.
export async function setPlayerPinIfUnset(
  code: string,
  name: string,
  pinHash: string,
  pinSalt: string,
): Promise<boolean> {
  const rows = await sql`
    UPDATE players SET pin_hash = ${pinHash}, pin_salt = ${pinSalt}
    WHERE room_code = ${code.toUpperCase()} AND name = ${name} AND pin_hash IS NULL
    RETURNING 1
  ` as any[];
  return rows.length > 0;
}

// Room-wide freshness for the trades cache. Returns 0 if the room has no players.
export async function roomLastModifiedMs(code: string): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(EXTRACT(EPOCH FROM MAX(updated_at))::bigint * 1000, 0) AS m
    FROM players WHERE room_code = ${code.toUpperCase()}
  ` as any[];
  return Number(rows[0]?.m ?? 0);
}

export async function deletePlayer(code: string, name: string): Promise<void> {
  await sql`DELETE FROM players WHERE room_code = ${code.toUpperCase()} AND name = ${name}`;
}

export async function deleteRoom(code: string): Promise<void> {
  await sql`DELETE FROM rooms WHERE code = ${code.toUpperCase()}`;
}

export async function roomExists(code: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM rooms WHERE code = ${code.toUpperCase()} LIMIT 1` as any[];
  return rows.length > 0;
}

// Apply a trade: decrement `from`'s count of `cardNum` by 1, increment `to`'s count by 1.
// Refuses if `from` does not have >= 2 of the card (dupe rule). Runs atomically.
// Returns true if applied, false otherwise (stale/invalid).
export async function applyTradeLeg(
  code: string,
  from: string,
  to: string,
  cardNum: number,
): Promise<boolean> {
  const roomCode = code.toUpperCase();
  const key = String(cardNum);
  // Guard: `from` must have >= 2 of this card. Use CTE + conditional update.
  const rows = await sql`
    WITH src AS (
      SELECT COALESCE((counts->>${key})::int, 0) AS cnt
      FROM players WHERE room_code = ${roomCode} AND name = ${from}
    )
    UPDATE players SET
      counts = jsonb_set(
        counts,
        ARRAY[${key}]::text[],
        to_jsonb(GREATEST(COALESCE((counts->>${key})::int, 0) - 1, 0))
      ),
      updated_at = NOW()
    WHERE room_code = ${roomCode} AND name = ${from}
      AND (SELECT cnt FROM src) >= 2
    RETURNING 1
  ` as any[];
  if (rows.length === 0) return false;

  await sql`
    UPDATE players SET
      counts = jsonb_set(
        counts,
        ARRAY[${key}]::text[],
        to_jsonb(COALESCE((counts->>${key})::int, 0) + 1)
      ),
      updated_at = NOW()
    WHERE room_code = ${roomCode} AND name = ${to}
  `;
  return true;
}
