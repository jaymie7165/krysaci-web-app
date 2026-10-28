import type { Config } from "tailwindcss";

// Play Haven – herní launcher: noční fialová (platforma) + zlatá (esport, Worlds).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#07050f", 900: "#0d0819", 800: "#130d26", 700: "#1c1338", 600: "#2a1f4d" },
        accent: { DEFAULT: "#8b5cf6", soft: "#c4a1ff" },
        gold: { DEFAULT: "#e3b866", deep: "#b8893a" },
        pulse: "#4fe3a8",
        ember: "#ff6b81",
        bone: "#ece9f6",
      },
      fontFamily: {
        display: ["Chakra Petch", "system-ui", "sans-serif"],
        sans: ["Figtree", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
