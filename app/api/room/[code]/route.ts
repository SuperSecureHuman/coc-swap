import { NextRequest, NextResponse } from "next/server";
import { deleteRoom, getRoom, roomExists } from "@/lib/db";
import { hashPin, isValidPin } from "@/lib/crypto";
import { checkLimit, recordFail, recordSuccess, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

function hasRoomCookie(req: NextRequest, code: string) {
  return req.cookies.get("room:" + code.toUpperCase())?.value === "1";
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!hasRoomCookie(req, code)) return NextResponse.json({ error: "not joined" }, { status: 403 });
  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { adminPinHash, salt, ...safe } = room;
  return NextResponse.json(safe);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const exists = await roomExists(code);
  if (!exists) return NextResponse.json({ error: "not found" }, { status: 404 });
  const res = NextResponse.json({ ok: true, code: code.toUpperCase() });
  res.cookies.set("room:" + code.toUpperCase(), "1", {
    httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 90, path: "/",
  });
  return res;
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!hasRoomCookie(req, code)) return NextResponse.json({ error: "not joined" }, { status: 403 });
  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rlKey = `${code.toUpperCase()}:adminPin:${clientIp(req)}`;
  const status = await checkLimit(rlKey);
  if (!status.allowed) {
    return NextResponse.json({ error: "too many attempts", retryAfterSec: status.retryAfterSec }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const pin: string | undefined = body?.adminPin;
  if (!pin || !isValidPin(pin) || hashPin(room.salt, pin) !== room.adminPinHash) {
    const s = await recordFail(rlKey);
    return NextResponse.json({
      error: "bad pin",
      retryAfterSec: "retryAfterSec" in s ? s.retryAfterSec : undefined,
    }, { status: 403 });
  }
  await recordSuccess(rlKey);
  await deleteRoom(code);
  return NextResponse.json({ ok: true });
}
