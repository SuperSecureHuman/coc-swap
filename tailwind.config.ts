import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Ingesta-derived: zinc-950 bg, zinc-900 cards, gold accent.
        clan: { bg: "#09090b", card: "#18181b", surface: "#27272a", muted: "#a1a1aa", accent: "#e5a00d" },
        // Card tier borders keyed to gemCost.
        tier: {
          50: "#71717a",   // zinc-500 — common
          70: "#3b82f6",   // blue-500 — rare
          90: "#a855f7",   // purple-500 — epic
          110: "#e5a00d",  // gold — legendary
        },
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
      },
      animation: {
        "fade-up": "fade-up 0.22s ease-out forwards",
        "fade-in": "fade-in 0.18s ease-out forwards",
      },
    },
  },
  plugins: [],
} satisfies Config;
