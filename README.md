# Clan Swap — Clash of Cards trade planner

Coordinate Clash of Cards event trades with your clan. Everyone lists their cards + duplicates, the app suggests optimal 1-for-1 swaps (and one-sided asks) that get the clan to full collections fastest.

## Rules encoded
1. You only ask for cards you don't have (need count = 0).
2. Trades stay within the same class (Elixir / Dark Elixir / Super Troop / Builder Base).
3. Anyone can accept even if they already own the card.

## Stack
- Next.js 15 (App Router) on Vercel
- Upstash Redis (Vercel Marketplace) for room state
- No accounts. Room code + optional admin PIN.

## Local dev
```bash
pnpm install
# create .env.local with:
#   UPSTASH_REDIS_REST_URL=...
#   UPSTASH_REDIS_REST_TOKEN=...
pnpm dev
```

## Deploy
```bash
vercel link
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel deploy --prod
```

## Card data
Icons bundled in `public/cards/`.
