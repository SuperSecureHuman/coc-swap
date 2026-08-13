import type { CardClass } from "./catalog";

export type PlayerCounts = Record<number, number>; // cardNumber -> count (0/1/2+)

export type Player = {
  name: string;
  counts: PlayerCounts;
  updatedAt: number;
};

export type Room = {
  code: string;
  adminPinHash: string; // sha256 hex of "salt:pin"
  salt: string;
  createdAt: number;
  players: Record<string, Player>; // key = name (case-preserved)
};

export type TradeSuggestion = {
  from: string; // giver
  to: string; // receiver
  cardNumber: number;
  cardName: string;
  class: CardClass;
  reciprocal?: { cardNumber: number; cardName: string }; // if giver also gets something back
  priority: number; // higher = more urgent (needer closer to completing class)
};
