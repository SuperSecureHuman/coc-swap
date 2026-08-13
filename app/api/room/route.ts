import { NextResponse } from "next/server";
import { createRoom, roomExists } from "@/lib/db";
import { randomCode, randomPin, hashPin } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST() {
  let code = "";
  for (let i = 0; i < 5; i++) {
    const c = randomCode(6);
    if (!(await roomExists(c))) { code = c; break; }
  }
  if (!code) return NextResponse.json({ error: "could not allocate code" }, { status: 500 });

  const pin = randomPin();
  const salt = randomCode(16);
  await createRoom({ code, adminPinHash: hashPin(salt, pin), salt });

  const res = NextResponse.json({ code, adminPin: pin });
  res.cookies.set("room:" + code, "1", {
    httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 90, path: "/",
  });
  return res;
}
