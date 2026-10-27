import type { Config } from "tailwindcss";

// Play Haven – noční fialová (základ), fialový akcent, mint pro výhry a progres.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#0a0814", 900: "#110d22", 800: "#18122f", 700: "#231b44", 600: "#332a5e" },
        accent: { DEFAULT: "#8b5cf6", soft: "#b79cff" },
        pulse: "#5fd6a4",
        ember: "#ff6b81",
        bone: "#ece9f8",
      },
      fontFamily: {
        display: ["Bricolage Grotesque", "system-ui", "sans-serif"],
        sans: ["Figtree", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(139,92,246,0.55), 0 12px 32px -12px rgba(139,92,246,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
