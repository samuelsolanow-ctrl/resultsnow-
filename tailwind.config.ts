import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0B1B2B", 2: "#334155", 3: "#64748B" },
        line: "#E3E8EE",
        paper: "#F6F8FA",
        sea: { DEFAULT: "#0E4C92", 600: "#0B3F7A", 50: "#EAF2FB" },
        flag: "#D7263D",
      },
      fontFamily: {
        sans: ["Barlow", "system-ui", "sans-serif"],
        display: ["'Barlow Condensed'", "Barlow", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
