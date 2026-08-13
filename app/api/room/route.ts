import { NextResponse } from "next/server";
import { getRoom, putRoom } from "@/lib/kv";
import { randomCode, randomPin, hashPin } from "@/lib/crypto";
import type { Room } from "@/lib/types";

export const runtime = "nodejs";

// POST /api/room — create room. Returns { code, adminPin }.
export async function POST() {
  // Try a few codes to avoid collision on the astronomically rare case.
  let code = "";
  for (let i = 0; i < 5; i++) {
    const c = randomCode(6);
    const existing = await getRoom(c);
    if (!existing) {
      code = c;
      break;
    }
  }
  if (!code) {
    return NextResponse.json({ error: "could not allocate room code" }, { status: 500 });
  }
  const pin = randomPin();
  const salt = randomCode(16);
  const room: Room = {
    code,
    salt,
    adminPinHash: hashPin(salt, pin),
    createdAt: Date.now(),
    players: {},
  };
  await putRoom(room);
  const res = NextResponse.json({ code, adminPin: pin });
  // Auto-join creator to the room via cookie
  res.cookies.set("room:" + code, "1", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
