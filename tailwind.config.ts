import type { Config } from "tailwindcss";

// Barvy platformy jsou CSS proměnné (viz globals.css), takže hráč může přepnout téma za běhu.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: v("ink-950"), 900: v("ink-900"), 800: v("ink-800"), 700: v("ink-700"), 600: v("ink-600") },
        accent: { DEFAULT: v("accent"), soft: v("accent-soft"), deep: v("accent-deep"), on: v("on-accent") },
        violet: { 300: v("accent-soft"), 400: v("accent-soft"), 500: v("accent"), 600: v("accent-deep") },
        gold: { DEFAULT: "#e3b866", deep: "#b8893a" },
        pulse: "#4fe3a8",
        ember: "#ff6b81",
        bone: "#ece9f6",
      },
      fontFamily: {
        display: ["Figtree", "system-ui", "sans-serif"],
        sans: ["Figtree", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
