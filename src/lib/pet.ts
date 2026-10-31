/** Pravidla peta. Čisté funkce, žádná databáze (jde je použít i na klientu). */
export const SPECIES = ["dragon", "cat", "mushroom", "butterfly", "bat"] as const;
export type Species = (typeof SPECIES)[number];
export const isSpecies = (s: unknown): s is Species => SPECIES.includes(s as Species);
/** Staré záznamy (žába, pes) spadnou na draka. */
export const asSpecies = (s: string): Species => (isSpecies(s) ? s : "dragon");

export const SPECIES_LABEL: Record<Species, [string, string, string]> = {
  dragon: ["Drak", "Drak", "Dragon"],
  cat: ["Kočka", "Mačka", "Cat"],
  mushroom: ["Houba", "Huba", "Mushroom"],
  butterfly: ["Motýl", "Motýľ", "Butterfly"],
  bat: ["Netopýr", "Netopier", "Bat"],
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
  dragon: [["Dračí vejce", "Dračie vajce", "Dragon egg"], ["Dráče", "Dráča", "Hatchling"], ["Mladý drak", "Mladý drak", "Young drake"], ["Dračí válečník", "Dračí bojovník", "Dragon warrior"], ["Kataklyzmatický dračí císař", "Kataklyzmatický dračí cisár", "Cataclysmic Dragon Emperor"]],
  cat: [["Zatoulané kotě", "Zatúlané mačiatko", "Stray kitten"], ["Kočka", "Mačka", "Cat"], ["Lovec", "Lovec", "Hunter"], ["Mystická kočka", "Mystická mačka", "Mystic cat"], ["Kočičí božstvo", "Mačacie božstvo", "Feline deity"]],
  mushroom: [["Houbička", "Hubička", "Sporeling"], ["Malá houba", "Malá huba", "Little shroom"], ["Lesní strážce", "Lesný strážca", "Forest warden"], ["Starý hřib", "Starý hríb", "Elder shroom"], ["Houbový král podhoubí", "Hubový kráľ podhubia", "King of the Mycelium"]],
  butterfly: [["Motýl", "Motýľ", "Butterfly"], ["Křídlatý motýl", "Krídlatý motýľ", "Winged butterfly"], ["Éterický motýl", "Éterický motýľ", "Ethereal butterfly"], ["Hvězdný motýl", "Hviezdny motýľ", "Star butterfly"], ["Kosmická motýlí císařovna", "Kozmická motýlia cisárovná", "Cosmic Butterfly Empress"]],
  bat: [["Netopýrek", "Netopierik", "Batling"], ["Mladý netopýr", "Mladý netopier", "Young bat"], ["Noční lovec", "Nočný lovec", "Night hunter"], ["Upíří strážce", "Upírsky strážca", "Vampire guard"], ["Nadvládce podsvětí", "Vládca podsvetia", "Overlord of the Underworld"]],
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
export const SLOTS = ["head", "face", "neck", "back", "aura", "orb"] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_LABEL: Record<Slot, [string, string, string]> = {
  head: ["Hlava", "Hlava", "Head"], face: ["Obličej", "Tvár", "Face"], neck: ["Krk", "Krk", "Neck"],
  back: ["Záda", "Chrbát", "Back"], aura: ["Aura", "Aura", "Aura"], orb: ["Společník", "Spoločník", "Companion"],
};
export type ShopItem = { key: string; slot: Slot; price: number; label: [string, string, string] };
export const SHOP: ShopItem[] = [
  { key: "mosswreath", slot: "head", price: 100, label: ["Mechový věnec", "Machový veniec", "Moss wreath"] },
  { key: "flowerwreath", slot: "head", price: 90, label: ["Květinový věnec", "Kvetinový veniec", "Flower wreath"] },
  { key: "wizardhat", slot: "head", price: 120, label: ["Čarodějův klobouk", "Čarodejnícky klobúk", "Wizard hat"] },
  { key: "butterflyornament", slot: "head", price: 110, label: ["Motýlí ozdoba", "Motýlia ozdoba", "Butterfly ornament"] },
  { key: "flowerhorns", slot: "head", price: 140, label: ["Květinové rohy", "Kvetinové rohy", "Flower horns"] },
  { key: "demonhorns", slot: "head", price: 160, label: ["Démonské rohy", "Démonské rohy", "Demon horns"] },
  { key: "halo", slot: "head", price: 220, label: ["Svatozář", "Svätožiara", "Halo"] },
  { key: "royalcrown", slot: "head", price: 300, label: ["Královská koruna", "Kráľovská koruna", "Royal crown"] },
  { key: "crystalcrown", slot: "head", price: 360, label: ["Křišťálová koruna", "Krištáľová koruna", "Crystal crown"] },
  { key: "hellcrown", slot: "head", price: 380, label: ["Pekelná koruna", "Pekelná koruna", "Hell crown"] },
  { key: "monocle", slot: "face", price: 80, label: ["Monokl", "Monokel", "Monocle"] },
  { key: "belledbow", slot: "neck", price: 60, label: ["Mašle se zvonečkem", "Mašľa so zvončekom", "Belled bow"] },
  { key: "magicscarf", slot: "neck", price: 70, label: ["Kouzelná šála", "Čarovný šál", "Magic scarf"] },
  { key: "piratecollar", slot: "neck", price: 80, label: ["Pirátský obojek", "Pirátsky obojok", "Pirate collar"] },
  { key: "spikedcollar", slot: "neck", price: 110, label: ["Obojek s hroty", "Obojok s ostňami", "Spiked collar"] },
  { key: "crystalamulet", slot: "neck", price: 150, label: ["Krystalový amulet", "Kryštálový amulet", "Crystal amulet"] },
  { key: "dragoncollar", slot: "neck", price: 200, label: ["Dračí obojek", "Dračí obojok", "Dragon collar"] },
  { key: "adventurepack", slot: "back", price: 90, label: ["Dobrodruhův batoh", "Dobrodruhov batoh", "Adventure pack"] },
  { key: "travelpack", slot: "back", price: 110, label: ["Cestovní batoh", "Cestovný batoh", "Travel pack"] },
  { key: "batwings", slot: "back", price: 180, label: ["Netopýří křídla", "Netopierie krídla", "Bat wings"] },
  { key: "royalcape", slot: "back", price: 200, label: ["Královský plášť", "Kráľovský plášť", "Royal cape"] },
  { key: "crystalorb", slot: "orb", price: 170, label: ["Křišťálová koule", "Krištáľová guľa", "Crystal orb"] },
  { key: "iceaura", slot: "aura", price: 250, label: ["Ledová aura", "Ľadová aura", "Ice aura"] },
  { key: "fireaura", slot: "aura", price: 250, label: ["Ohnivá aura", "Ohnivá aura", "Fire aura"] },
  { key: "darkaura", slot: "aura", price: 280, label: ["Temná aura", "Temná aura", "Dark aura"] },
];
/** Každý druh má vlastní scénu (public/pets/bg/<druh>.webp). */
export const bgUrl = (species: Species) => `/pets/bg/${species}.webp`;
/** Cena dalšího slotu na peta. Hráč může nasbírat všech 5 druhů. */
export const SLOT_PRICE = 1500;
export const MAX_SLOTS = SPECIES.length;

export type Gear = Partial<Record<Slot, string>>;
export function parseGear(raw: string | null | undefined): Gear {
  try {
    const o = JSON.parse(raw || "{}");
    const g: Gear = {};
    for (const sl of SLOTS) {
      const k = o?.[sl];
      if (typeof k === "string" && SHOP.some((i) => i.key === k && i.slot === sl)) g[sl] = k;
    }
    return g;
  } catch {
    return {};
  }
}

/* ---------- Obrázky a kotvy pro doplňky ---------- */
/** Poměr stran (w/h) obrázků peta, [druh][stupeň]. Z public/pets/meta.json. */
export const PET_SIZE: Record<Species, [number, number][]> = {
  dragon: [[179, 235], [212, 319], [351, 448], [440, 590], [605, 746]],
  cat: [[184, 266], [213, 355], [268, 466], [353, 588], [331, 714]],
  mushroom: [[161, 185], [216, 282], [281, 418], [375, 569], [478, 758]],
  butterfly: [[211, 200], [302, 305], [354, 440], [421, 701], [493, 861]],
  bat: [[164, 226], [255, 316], [345, 377], [360, 492], [479, 606]],
};
/** Jak velkou část výšky scény zabírá pet v daném stupni. */
export const STAGE_HEIGHT = [0.5, 0.62, 0.76, 0.88, 1];

/** Kotvy v poměru k obrázku peta: vršek hlavy, šířka hlavy, krk, obličej, záda. */
export type Anchor = { headTop: number; headW: number; neckY: number; neckW: number; faceX: number; faceY: number; backY: number; backW: number };
const A = (headTop: number, headW: number, neckY: number, neckW: number, faceX: number, faceY: number, backY = 0.55, backW = 1): Anchor => ({ headTop, headW, neckY, neckW, faceX, faceY, backY, backW });
export const ANCHORS: Record<Species, Anchor[]> = {
  dragon: [A(0.06, 0.5, 0.66, 0.55, 0.6, 0.4), A(0.1, 0.5, 0.58, 0.4, 0.6, 0.33), A(0.1, 0.4, 0.55, 0.36, 0.58, 0.3), A(0.1, 0.36, 0.55, 0.32, 0.57, 0.3), A(0.08, 0.34, 0.55, 0.3, 0.57, 0.28)],
  cat: [A(0.05, 0.6, 0.58, 0.5, 0.6, 0.3), A(0.05, 0.56, 0.56, 0.44, 0.6, 0.3), A(0.06, 0.45, 0.54, 0.4, 0.58, 0.3), A(0.07, 0.4, 0.54, 0.36, 0.58, 0.28), A(0.06, 0.4, 0.53, 0.34, 0.58, 0.27)],
  mushroom: [A(0.04, 0.85, 0.7, 0.5, 0.64, 0.56), A(0.04, 0.8, 0.72, 0.5, 0.64, 0.58), A(0.08, 0.62, 0.62, 0.4, 0.6, 0.5), A(0.1, 0.66, 0.6, 0.4, 0.6, 0.48), A(0.1, 0.62, 0.6, 0.4, 0.6, 0.46)],
  butterfly: [A(0.36, 0.34, 0.68, 0.34, 0.6, 0.5, 0.5, 1), A(0.34, 0.2, 0.6, 0.2, 0.55, 0.45, 0.5, 1), A(0.36, 0.14, 0.55, 0.14, 0.54, 0.45, 0.5, 1), A(0.33, 0.1, 0.55, 0.1, 0.53, 0.45, 0.5, 1), A(0.25, 0.1, 0.5, 0.1, 0.53, 0.4, 0.5, 1)],
  bat: [A(0.08, 0.62, 0.62, 0.5, 0.62, 0.42), A(0.08, 0.5, 0.62, 0.4, 0.6, 0.45), A(0.1, 0.28, 0.58, 0.22, 0.56, 0.38, 0.5, 1), A(0.1, 0.28, 0.56, 0.22, 0.56, 0.36, 0.5, 1), A(0.1, 0.28, 0.56, 0.22, 0.56, 0.34, 0.5, 1)],
};
/** Velikost doplňku vůči šířce hlavy / krku a kolik jeho výšky leží nad kotvou (head). */
export const ITEM_FIT: Record<string, { scale: number; lift?: number }> = {
  royalcrown: { scale: 0.9, lift: 0.85 }, crystalcrown: { scale: 0.9, lift: 0.85 }, hellcrown: { scale: 0.95, lift: 0.85 },
  wizardhat: { scale: 1, lift: 0.85 }, demonhorns: { scale: 1.0, lift: 0.7 }, flowerhorns: { scale: 1.0, lift: 0.7 },
  flowerwreath: { scale: 1.05, lift: 0.6 }, mosswreath: { scale: 1.05, lift: 0.6 }, butterflyornament: { scale: 0.5, lift: 0.6 },
  halo: { scale: 0.85, lift: 1.1 }, monocle: { scale: 0.32 },
  dragoncollar: { scale: 0.8 }, magicscarf: { scale: 0.75 }, piratecollar: { scale: 0.8 }, crystalamulet: { scale: 0.5 }, belledbow: { scale: 0.6 }, spikedcollar: { scale: 0.8 },
  batwings: { scale: 1.25 }, royalcape: { scale: 1 }, adventurepack: { scale: 0.7 }, travelpack: { scale: 0.7 },
};
export const ITEM_SIZE: Record<string, [number, number]> = {
  royalcrown: [222, 202], wizardhat: [239, 192], demonhorns: [220, 215], flowerwreath: [214, 159], batwings: [237, 219], dragoncollar: [210, 194], royalcape: [262, 231], magicscarf: [176, 201], adventurepack: [218, 217], crystalorb: [189, 209], iceaura: [195, 272], fireaura: [200, 226], darkaura: [200, 228], halo: [245, 178], monocle: [164, 292], piratecollar: [191, 173], crystalamulet: [173, 194], belledbow: [198, 143], travelpack: [197, 206], spikedcollar: [231, 164], crystalcrown: [192, 201], flowerhorns: [216, 186], mosswreath: [221, 184], butterflyornament: [204, 184], hellcrown: [222, 202],
};
