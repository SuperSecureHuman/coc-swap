import { NextRequest, NextResponse } from "next/server";
import { getRoom, putRoom } from "@/lib/kv";
import type { PlayerCounts } from "@/lib/types";

export const runtime = "nodejs";

function hasRoomCookie(req: NextRequest, code: string) {
  return req.cookies.get("room:" + code.toUpperCase())?.value === "1";
}

// PUT /api/room/[code]/player  body: { name: string, counts: {number: number} }
export async function PUT(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!hasRoomCookie(req, code)) return NextResponse.json({ error: "not joined" }, { status: 403 });
  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const name: string | undefined = body?.name?.trim();
  const rawCounts = body?.counts;
  if (!name || name.length > 40) return NextResponse.json({ error: "bad name" }, { status: 400 });
  if (!rawCounts || typeof rawCounts !== "object") return NextResponse.json({ error: "bad counts" }, { status: 400 });

  const counts: PlayerCounts = {};
  for (const [k, v] of Object.entries(rawCounts)) {
    const num = Number(k);
    const cnt = Number(v);
    if (!Number.isInteger(num) || num < 1 || num > 100) continue;
    if (!Number.isFinite(cnt) || cnt < 0 || cnt > 99) continue;
    if (cnt > 0) counts[num] = Math.floor(cnt);
  }

  room.players[name] = { name, counts, updatedAt: Date.now() };
  await putRoom(room);
  return NextResponse.json({ ok: true });
}

// DELETE /api/room/[code]/player?name=X — remove yourself (or admin kick w/ pin)
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!hasRoomCookie(req, code)) return NextResponse.json({ error: "not joined" }, { status: 403 });
  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
  const url = new URL(req.url);
  const name = url.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "no name" }, { status: 400 });
  delete room.players[name];
  await putRoom(room);
  return NextResponse.json({ ok: true });
}
