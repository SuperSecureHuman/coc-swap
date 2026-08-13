import { NextRequest, NextResponse } from "next/server";
import { getRoom } from "@/lib/kv";
import { computeTrades } from "@/lib/match";

export const runtime = "nodejs";

function hasRoomCookie(req: NextRequest, code: string) {
  return req.cookies.get("room:" + code.toUpperCase())?.value === "1";
}

// GET /api/room/[code]/trades — compute trade suggestions
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!hasRoomCookie(req, code)) return NextResponse.json({ error: "not joined" }, { status: 403 });
  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(computeTrades(room));
}
