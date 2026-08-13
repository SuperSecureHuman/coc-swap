import { NextRequest, NextResponse } from "next/server";
import { getRoom, roomLastModifiedMs } from "@/lib/db";
import { computeTrades } from "@/lib/match";

export const runtime = "nodejs";

function hasRoomCookie(req: NextRequest, code: string) {
  return req.cookies.get("room:" + code.toUpperCase())?.value === "1";
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!hasRoomCookie(req, code)) return NextResponse.json({ error: "not joined" }, { status: 403 });

  // Cheap staleness check first: max(updated_at) across players. If unchanged since the
  // caller's If-Modified-Since, respond 304 without loading players + computing trades.
  const lastMs = await roomLastModifiedMs(code);
  const lastDate = lastMs > 0 ? new Date(Math.floor(lastMs / 1000) * 1000) : null; // truncate to seconds — HTTP-Date resolution
  const ims = req.headers.get("if-modified-since");
  if (lastDate && ims) {
    const imsMs = Date.parse(ims);
    if (Number.isFinite(imsMs) && lastDate.getTime() <= imsMs) {
      return new NextResponse(null, { status: 304, headers: { "Last-Modified": lastDate.toUTCString() } });
    }
  }

  const room = await getRoom(code);
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
  const trades = computeTrades(room);
  const res = NextResponse.json(trades);
  if (lastDate) res.headers.set("Last-Modified", lastDate.toUTCString());
  return res;
}
