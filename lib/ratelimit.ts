import { sql } from "./db";

// Bad-attempt rate limiter, keyed by "<code>:<action>:<ip>".
// Tiered lockout: 3 fails = 30s, 6 = 5min, 10+ = 1h.
// Success resets the counter.

const TIERS: { atLeast: number; lockSeconds: number }[] = [
  { atLeast: 10, lockSeconds: 3600 },
  { atLeast: 6, lockSeconds: 300 },
  { atLeast: 3, lockSeconds: 30 },
];

export type RateLimitStatus =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };

export async function checkLimit(key: string): Promise<RateLimitStatus> {
  const rows = await sql`
    SELECT count, EXTRACT(EPOCH FROM (locked_until - NOW()))::int AS retry_after
    FROM bad_attempts WHERE key = ${key} LIMIT 1
  ` as any[];
  if (rows.length === 0) return { allowed: true };
  const retry = Number(rows[0].retry_after ?? 0);
  if (retry > 0) return { allowed: false, retryAfterSec: retry };
  return { allowed: true };
}

export async function recordFail(key: string): Promise<RateLimitStatus> {
  const rows = await sql`
    INSERT INTO bad_attempts (key, count, updated_at) VALUES (${key}, 1, NOW())
    ON CONFLICT (key) DO UPDATE SET count = bad_attempts.count + 1, updated_at = NOW()
    RETURNING count
  ` as any[];
  const count = Number(rows[0].count);
  const tier = TIERS.find((t) => count >= t.atLeast);
  if (!tier) return { allowed: true };
  await sql`
    UPDATE bad_attempts SET locked_until = NOW() + (${tier.lockSeconds} || ' seconds')::interval
    WHERE key = ${key}
  `;
  return { allowed: false, retryAfterSec: tier.lockSeconds };
}

export async function recordSuccess(key: string): Promise<void> {
  await sql`DELETE FROM bad_attempts WHERE key = ${key}`;
}

// Rough IP extractor. Works behind Vercel's edge (x-forwarded-for).
export function clientIp(req: { headers: Headers }): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
