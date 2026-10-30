import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#22262B", 2: "#334155", 3: "#64748B" },
        line: "#E3E8EE",
        paper: "#F6F8FA",
        sea: { DEFAULT: "#1F7F96", 600: "#186A7D", 50: "#E8F5F8" },
        flag: "#D7263D",
        night: { DEFAULT: "#2A2F35", 2: "#353B42" },
        sky: { DEFAULT: "#7FC7D6", 600: "#4FA9BD" },
      },
      fontFamily: {
        sans: ["Barlow", "system-ui", "sans-serif"],
        display: ["'Barlow Condensed'", "Barlow", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
