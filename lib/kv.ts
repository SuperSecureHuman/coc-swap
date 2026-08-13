import { Redis } from "@upstash/redis";
import type { Room } from "./types";

// Vercel KV / Upstash Redis
export const redis = Redis.fromEnv();

export const KEY = (code: string) => `room:${code.toUpperCase()}`;
export const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function getRoom(code: string): Promise<Room | null> {
  const r = await redis.get<Room>(KEY(code));
  return r ?? null;
}

export async function putRoom(room: Room): Promise<void> {
  await redis.set(KEY(room.code), room, { ex: TTL_SECONDS });
}

export async function deleteRoom(code: string): Promise<void> {
  await redis.del(KEY(code));
}
