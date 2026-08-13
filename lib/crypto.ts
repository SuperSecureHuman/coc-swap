import crypto from "node:crypto";

export function randomCode(len = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function randomPin(): string {
  // 4-digit, avoid leading 0 confusion by allowing full 0000-9999
  return String(crypto.randomInt(0, 10000)).padStart(4, "0");
}

export function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function hashPin(salt: string, pin: string): string {
  return sha256(`${salt}:${pin}`);
}

// Client-facing name rules. Server enforces this; UI mirrors it.
// Letters, digits, space, underscore, hyphen. 1-20 chars.
export const NAME_REGEX = /^[A-Za-z0-9 _-]{1,20}$/;
export function isValidName(s: string): boolean {
  return typeof s === "string" && NAME_REGEX.test(s.trim()) && s.trim().length === s.length;
}
export const PIN_REGEX = /^\d{4}$/;
export function isValidPin(s: string): boolean {
  return typeof s === "string" && PIN_REGEX.test(s);
}
