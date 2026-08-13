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
