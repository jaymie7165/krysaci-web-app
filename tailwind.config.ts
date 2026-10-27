import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#07080d", 900: "#0b0d14", 800: "#11141e", 700: "#1a1e2c", 600: "#252a3c" },
        accent: { DEFAULT: "#7c5cff", soft: "#a594ff" },
        pulse: "#2ee6a6",
        ember: "#ff5d73",
      },
      fontFamily: {
        display: ["Rajdhani", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(124,92,255,0.55)",
      },
    },
  },
  plugins: [],
};

export default config;
