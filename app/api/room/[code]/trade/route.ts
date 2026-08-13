import { NextRequest, NextResponse } from "next/server";
import { applyTradeLeg, roomExists } from "@/lib/db";

export const runtime = "nodejs";

function hasRoomCookie(req: NextRequest, code: string) {
  return req.cookies.get("room:" + code.toUpperCase())?.value === "1";
}

// Body: { from, to, cardNumber, reciprocalCardNumber? }
// Applies both legs when reciprocal is present. Idempotent-ish: if `from` no
// longer has >= 2, we return { applied: false } so the UI can refresh.
export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!hasRoomCookie(req, code)) return NextResponse.json({ error: "not joined" }, { status: 403 });
  if (!(await roomExists(code))) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const from: string | undefined = body?.from?.trim();
  const to: string | undefined = body?.to?.trim();
  const cardNumber = Number(body?.cardNumber);
  const recip = body?.reciprocalCardNumber != null ? Number(body.reciprocalCardNumber) : null;

  if (!from || !to || from === to) return NextResponse.json({ error: "bad players" }, { status: 400 });
  if (!Number.isInteger(cardNumber) || cardNumber < 1 || cardNumber > 100) {
    return NextResponse.json({ error: "bad card" }, { status: 400 });
  }
  if (recip !== null && (!Number.isInteger(recip) || recip < 1 || recip > 100)) {
    return NextResponse.json({ error: "bad reciprocal" }, { status: 400 });
  }

  const legA = await applyTradeLeg(code, from, to, cardNumber);
  if (!legA) return NextResponse.json({ applied: false, reason: "stale" });

  if (recip !== null) {
    const legB = await applyTradeLeg(code, to, from, recip);
    // If leg B fails, leg A already went through — accept the asymmetric result rather than rolling back.
    return NextResponse.json({ applied: true, reciprocalApplied: legB });
  }
  return NextResponse.json({ applied: true });
}
