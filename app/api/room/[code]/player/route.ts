import { NextRequest, NextResponse } from "next/server";
import { deletePlayer, getPlayerPin, getRoom, roomExists, setPlayerPinIfUnset, upsertPlayer } from "@/lib/db";
import { hashPin, isValidName, isValidPin, randomCode } from "@/lib/crypto";
import { checkLimit, recordFail, recordSuccess, clientIp } from "@/lib/ratelimit";
import type { PlayerCounts } from "@/lib/types";

export const runtime = "nodejs";

function hasRoomCookie(req: NextRequest, code: string) {
  return req.cookies.get("room:" + code.toUpperCase())?.value === "1";
}

// PUT: create/update this player's counts. Body: { name, counts, pin, setPin? }
// - If the name has no PIN yet: `setPin` (4 digits) is required and becomes the PIN.
// - If the name already has a PIN: `pin` must match. Wrong PIN counts against rate limit.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!hasRoomCookie(req, code)) return NextResponse.json({ error: "not joined" }, { status: 403 });
  if (!(await roomExists(code))) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const rawName: string | undefined = body?.name;
  const rawCounts = body?.counts;
  const pin: string | undefined = body?.pin;
  const setPin: string | undefined = body?.setPin;

  if (!rawName || !isValidName(rawName)) {
    return NextResponse.json({ error: "name must be 1-20 chars, letters/digits/space/_/-" }, { status: 400 });
  }
  const name = rawName.trim();

  if (!rawCounts || typeof rawCounts !== "object") return NextResponse.json({ error: "bad counts" }, { status: 400 });

  const counts: PlayerCounts = {};
  for (const [k, v] of Object.entries(rawCounts)) {
    const num = Number(k);
    const cnt = Number(v);
    if (!Number.isInteger(num) || num < 1 || num > 100) continue;
    if (!Number.isFinite(cnt) || cnt < 0 || cnt > 99) continue;
    if (cnt > 0) counts[num] = Math.floor(cnt);
  }

  const rlKey = `${code.toUpperCase()}:playerPin:${clientIp(req)}`;
  const existing = await getPlayerPin(code, name);

  if (existing) {
    // Verify PIN.
    const status = await checkLimit(rlKey);
    if (!status.allowed) {
      return NextResponse.json({ error: "too many attempts", retryAfterSec: status.retryAfterSec }, { status: 429 });
    }
    if (!pin || !isValidPin(pin) || hashPin(existing.salt, pin) !== existing.hash) {
      const s = await recordFail(rlKey);
      return NextResponse.json({
        error: "bad pin",
        retryAfterSec: "retryAfterSec" in s ? s.retryAfterSec : undefined,
      }, { status: 403 });
    }
    await recordSuccess(rlKey);
    await upsertPlayer(code, name, counts);
    return NextResponse.json({ ok: true, pinSet: true });
  }

  // First save. Insert row so the ON CONFLICT DO NOTHING PIN write below can find it.
  if (!setPin || !isValidPin(setPin)) {
    return NextResponse.json({ error: "pin required (4 digits) for new player" }, { status: 400 });
  }
  await upsertPlayer(code, name, counts);
  const pinSalt = randomCode(16);
  const pinHash = hashPin(pinSalt, setPin);
  const claimed = await setPlayerPinIfUnset(code, name, pinHash, pinSalt);
  if (!claimed) {
    // Race: someone claimed the PIN between our getPlayerPin and setPlayerPinIfUnset.
    // Reject so caller can retry with pin instead of setPin.
    return NextResponse.json({ error: "name just claimed, retry with pin" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, pinSet: true, firstClaim: true });
}

// DELETE: admin-kick a player. Requires admin PIN (see room DELETE for the same gate).
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!hasRoomCookie(req, code)) return NextResponse.json({ error: "not joined" }, { status: 403 });
  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
  const url = new URL(req.url);
  const name = url.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "no name" }, { status: 400 });

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
  await deletePlayer(code, name);
  return NextResponse.json({ ok: true });
}
