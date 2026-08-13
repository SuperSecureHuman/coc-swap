import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        clan: { bg: "#1a1410", card: "#2a1f18", accent: "#e6b34a" },
      },
    },
  },
  plugins: [],
} satisfies Config;
