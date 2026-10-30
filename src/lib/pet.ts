/** Pravidla peta. Čisté funkce, žádná databáze (jde je použít i na klientu). */
export const SPECIES = ["frog", "cat", "dog", "dragon"] as const;
export type Species = (typeof SPECIES)[number];
export const isSpecies = (s: unknown): s is Species => SPECIES.includes(s as Species);

export const SPECIES_LABEL: Record<Species, [string, string, string]> = {
  frog: ["Žába", "Žaba", "Frog"],
  cat: ["Kočka", "Mačka", "Cat"],
  dog: ["Pes", "Pes", "Dog"],
  dragon: ["Drak", "Drak", "Dragon"],
};

/** Za odehranou hru. Hra s někým z komunity dává dvojnásobek peněz a XP. */
export const GAME_REWARD = { treats: 5, xp: 20, coins: 15 };
export const SOCIAL_DAILY_CAP = 5; // kolikrát denně se dvojnásobek počítá
export const SATED_MINUTES = 10; // po pamlsku je pet 10 minut spokojený
export const SLEEP_HOURS = 48; // po 48 h bez pamlsku pet spí

export const levelFromXp = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 20)) + 1;
export const xpForLevel = (level: number) => 20 * (level - 1) ** 2;

/** Od jaké úrovně se pet vyvine do dalšího stupně (0 až 4). */
export const STAGE_LEVELS = [1, 5, 10, 18, 28];
export const stageFromLevel = (level: number) => STAGE_LEVELS.filter((l) => level >= l).length - 1;

export const STAGE_NAMES: Record<Species, [string, string, string][]> = {
  frog: [["Pulec", "Žubrienka", "Tadpole"], ["Pulec s nožkami", "Žubrienka s nožičkami", "Legged tadpole"], ["Žabka", "Žabka", "Froglet"], ["Žába", "Žaba", "Frog"], ["Žabí král", "Žabí kráľ", "Frog King"]],
  cat: [["Koťátko", "Mačiatko", "Kitten"], ["Kočka", "Mačka", "Cat"], ["Kočka v šále", "Mačka v šále", "Scarfed cat"], ["Pruhovaný lovec", "Pruhovaný lovec", "Striped hunter"], ["Kočičí král", "Mačací kráľ", "Cat King"]],
  dog: [["Štěně", "Šteňa", "Puppy"], ["Pes", "Pes", "Dog"], ["Pes v šále", "Pes v šále", "Scarfed dog"], ["Věrný strážce", "Verný strážca", "Loyal guard"], ["Psí král", "Psí kráľ", "Dog King"]],
  dragon: [["Vejce", "Vajce", "Egg"], ["Dráče", "Dráča", "Hatchling"], ["Malý drak", "Malý drak", "Young drake"], ["Dračí válečník", "Dračí bojovník", "Dragon warrior"], ["Dračí král", "Dračí kráľ", "Dragon King"]],
};

export function hoursHungry(lastFedAt: Date, now = new Date()) {
  return Math.max(0, (now.getTime() - lastFedAt.getTime()) / 3600000);
}

/**
 * Stav peta podle toho, jak dlouho nejedl. Každých 16 h bez pamlsku se zobrazený vzhled vrátí o stupeň zpět
 * (po 48 h pet spí a je nejhorší). XP ani level se neztrácí, po nakrmení se vzhled vrátí.
 */
export function condition(lastFedAt: Date, now = new Date()) {
  const h = hoursHungry(lastFedAt, now);
  const minutes = h * 60;
  const penalty = Math.min(3, Math.floor(h / 16));
  const sleeping = h >= SLEEP_HOURS;
  const mood: "sated" | "ok" | "hungry" | "starving" | "sleeping" =
    sleeping ? "sleeping" : minutes < SATED_MINUTES ? "sated" : penalty >= 2 ? "starving" : penalty === 1 || h >= 8 ? "hungry" : "ok";
  return { hours: h, penalty, sleeping, mood };
}

export const shownStage = (level: number, penalty: number) => Math.max(0, stageFromLevel(level) - penalty);

/* ---------- Obchod ---------- */
export type ShopItem = { key: string; kind: "hat" | "bg" | "tint"; price: number; label: [string, string, string] };
export const SHOP: ShopItem[] = [
  { key: "cap", kind: "hat", price: 60, label: ["Kšiltovka", "Šiltovka", "Cap"] },
  { key: "bow", kind: "hat", price: 80, label: ["Mašle", "Mašľa", "Bow"] },
  { key: "party", kind: "hat", price: 100, label: ["Párty čepička", "Párty čiapočka", "Party hat"] },
  { key: "tophat", kind: "hat", price: 150, label: ["Cylindr", "Cylinder", "Top hat"] },
  { key: "headphones", kind: "hat", price: 200, label: ["Sluchátka", "Slúchadlá", "Headphones"] },
  { key: "night", kind: "bg", price: 100, label: ["Noční obloha", "Nočná obloha", "Night sky"] },
  { key: "beach", kind: "bg", price: 120, label: ["Pláž", "Pláž", "Beach"] },
  { key: "neon", kind: "bg", price: 160, label: ["Neonové město", "Neónové mesto", "Neon city"] },
  { key: "warm", kind: "tint", price: 90, label: ["Teplý odstín", "Teplý odtieň", "Warm tint"] },
  { key: "cool", kind: "tint", price: 90, label: ["Chladný odstín", "Chladný odtieň", "Cool tint"] },
  { key: "candy", kind: "tint", price: 90, label: ["Cukrový odstín", "Cukrový odtieň", "Candy tint"] },
];
export const TINT_FILTER: Record<string, string> = { warm: "hue-rotate(40deg)", cool: "hue-rotate(180deg)", candy: "hue-rotate(290deg) saturate(1.2)" };
export const BG_CSS: Record<string, string> = {
  meadow: "linear-gradient(180deg,#7ec8ff 0%,#c8f0ff 55%,#6bbf59 55%,#4a9a3e 100%)",
  night: "linear-gradient(180deg,#0b1030 0%,#2a2060 60%,#1a1440 60%,#120e30 100%)",
  beach: "linear-gradient(180deg,#ffb88a 0%,#ffe2b5 50%,#4fc3d9 50%,#e8d29a 78%)",
  neon: "linear-gradient(180deg,#14002e 0%,#5a1a8a 55%,#ff2e9a 55%,#2a0a4a 100%)",
};
