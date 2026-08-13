import { NextRequest, NextResponse } from "next/server";
import { deleteRoom, getRoom } from "@/lib/kv";
import { hashPin } from "@/lib/crypto";

export const runtime = "nodejs";

function hasRoomCookie(req: NextRequest, code: string) {
  return req.cookies.get("room:" + code.toUpperCase())?.value === "1";
}

// GET /api/room/[code] — full room state (public within cookie holders)
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!hasRoomCookie(req, code)) return NextResponse.json({ error: "not joined" }, { status: 403 });
  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
  // strip secrets
  const { adminPinHash, salt, ...safe } = room;
  return NextResponse.json(safe);
}

// POST /api/room/[code] — join with code. Body: { code, adminPin? }. Sets cookie.
export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
  const res = NextResponse.json({ ok: true, code: room.code });
  res.cookies.set("room:" + room.code, "1", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}

// DELETE /api/room/[code] — admin only. Body: { adminPin }
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!hasRoomCookie(req, code)) return NextResponse.json({ error: "not joined" }, { status: 403 });
  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const pin: string | undefined = body?.adminPin;
  if (!pin || hashPin(room.salt, pin) !== room.adminPinHash) {
    return NextResponse.json({ error: "bad pin" }, { status: 403 });
  }
  await deleteRoom(code);
  return NextResponse.json({ ok: true });
}
