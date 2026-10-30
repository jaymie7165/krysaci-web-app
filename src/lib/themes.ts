/** Barevná témata webu. Každý hráč si vybere svoje, ukládá se k účtu i do cookie. */
export const THEMES = [
  { key: "pink", label: ["Růžová", "Ružová", "Pink"], swatch: "#d9467f" },
  { key: "indigo", label: ["Modrá", "Modrá", "Blue"], swatch: "#6366f1" },
  { key: "violet", label: ["Fialová", "Fialová", "Violet"], swatch: "#8b5cf6" },
  { key: "teal", label: ["Tyrkysová", "Tyrkysová", "Teal"], swatch: "#14b89a" },
  { key: "amber", label: ["Oranžová", "Oranžová", "Amber"], swatch: "#f08a2c" },
  { key: "cyan", label: ["Azurová", "Azúrová", "Cyan"], swatch: "#22b8e0" },
] as const;

export type ThemeKey = (typeof THEMES)[number]["key"];
export const DEFAULT_THEME: ThemeKey = "pink";
export const isTheme = (k: unknown): k is ThemeKey => THEMES.some((t) => t.key === k);

