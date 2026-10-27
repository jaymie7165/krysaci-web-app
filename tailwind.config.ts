import type { Config } from "tailwindcss";

// Play Haven – přílivová modrozelená (základ), lucerna (akce), mořské sklo (progres).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#08171d", 900: "#0c1f27", 800: "#112a34", 700: "#183743", 600: "#234856" },
        accent: { DEFAULT: "#f2a93b", soft: "#f7c46f" },
        pulse: "#7fd1b9",
        ember: "#f1705f",
        bone: "#ece7db",
      },
      fontFamily: {
        display: ["Bricolage Grotesque", "system-ui", "sans-serif"],
        sans: ["Figtree", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(242,169,59,0.5), 0 12px 32px -12px rgba(242,169,59,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
