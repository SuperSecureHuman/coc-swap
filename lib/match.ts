import { CARDS_BY_CLASS, CARD_BY_NUM, CLASSES, type CardClass } from "./catalog";
import type { Player, Room, TradeSuggestion } from "./types";

// A player "needs" a card if count === 0 (or missing).
// A player "offers" a card if count >= 2 (duplicate; keeps their 1).
// Rules:
//   1. Only ask for cards you don't have.
//   2. Same class only.
//   3. Accepter can accept even if they already own it — implicit; direct matches prioritised.

function need(p: Player, num: number): boolean {
  return !(p.counts[num] && p.counts[num] >= 1);
}
function offers(p: Player, num: number): boolean {
  return (p.counts[num] ?? 0) >= 2;
}

function classCompletion(p: Player, cls: CardClass): { got: number; total: number } {
  const cards = CARDS_BY_CLASS[cls];
  let got = 0;
  for (const c of cards) if ((p.counts[c.number] ?? 0) >= 1) got++;
  return { got, total: cards.length };
}

export function computeTrades(room: Room): {
  reciprocal: TradeSuggestion[];
  oneSided: TradeSuggestion[];
  stats: Record<string, { got: number; total: number }[]>;
} {
  const players = Object.values(room.players);
  const suggestions: TradeSuggestion[] = [];
  const usedNeed = new Set<string>(); // `${player}:${cardNum}` — needer already got a match this round

  for (const cls of CLASSES) {
    const cards = CARDS_BY_CLASS[cls];

    // Collect (needer, cardNum) and (offerer, cardNum) for this class
    const needs: { player: Player; num: number }[] = [];
    const offersList: { player: Player; num: number }[] = [];
    for (const p of players) {
      for (const c of cards) {
        if (need(p, c.number)) needs.push({ player: p, num: c.number });
        if (offers(p, c.number)) offersList.push({ player: p, num: c.number });
      }
    }

    // Score each (need, offer) pair
    type Edge = { need: (typeof needs)[number]; offer: (typeof offersList)[number]; score: number; reciprocal?: number };
    const edges: Edge[] = [];
    for (const nd of needs) {
      for (const of_ of offersList) {
        if (nd.player.name === of_.player.name) continue;
        if (nd.num !== of_.num) continue;
        // reciprocal: does offerer need a card that needer has as dupe (same class)?
        let recipNum: number | undefined;
        for (const c of cards) {
          if (need(of_.player, c.number) && offers(nd.player, c.number)) {
            recipNum = c.number;
            break;
          }
        }
        const { got, total } = classCompletion(nd.player, cls);
        const remaining = total - got;
        let score = 0;
        if (recipNum) score += 100;
        if (remaining <= 1) score += 20;
        else if (remaining <= 3) score += 10;
        score -= remaining * 0.1; // tiebreak: prefer closer-to-done
        edges.push({ need: nd, offer: of_, score, reciprocal: recipNum });
      }
    }

    edges.sort((a, b) => b.score - a.score);

    const usedOffer = new Set<string>(); // one dupe per copy — track offerer:cardNum
    for (const e of edges) {
      const nk = `${e.need.player.name}:${e.need.num}`;
      const ok = `${e.offer.player.name}:${e.offer.num}`;
      if (usedNeed.has(nk)) continue;
      if (usedOffer.has(ok)) continue;
      usedNeed.add(nk);
      usedOffer.add(ok);
      const card = CARD_BY_NUM[e.need.num];
      const s: TradeSuggestion = {
        from: e.offer.player.name,
        to: e.need.player.name,
        cardNumber: e.need.num,
        cardName: card.name,
        class: cls,
        priority: e.score,
      };
      if (e.reciprocal) {
        const rc = CARD_BY_NUM[e.reciprocal];
        s.reciprocal = { cardNumber: e.reciprocal, cardName: rc.name };
        // also mark the reciprocal side as used so we don't double-book
        usedNeed.add(`${e.offer.player.name}:${e.reciprocal}`);
        usedOffer.add(`${e.need.player.name}:${e.reciprocal}`);
      }
      suggestions.push(s);
    }
  }

  const reciprocal = suggestions.filter((s) => s.reciprocal);
  const oneSided = suggestions.filter((s) => !s.reciprocal);
  reciprocal.sort((a, b) => b.priority - a.priority);
  oneSided.sort((a, b) => b.priority - a.priority);

  const stats: Record<string, { got: number; total: number }[]> = {};
  for (const p of players) {
    stats[p.name] = CLASSES.map((cls) => classCompletion(p, cls));
  }

  return { reciprocal, oneSided, stats };
}
