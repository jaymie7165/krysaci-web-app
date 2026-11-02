/**
 * FiveM (GTA RP): hráč si vybírá server (SkyRP, Pohodáři, GenK 3.0...). Server poznáme z Discord aktivity,
 * kterou FiveM posílá (details/state). Název se očistí od barevných kódů, "Playing on" a počtu hráčů.
 */
const KNOWN: { re: RegExp; name: string }[] = [
  { re: /sky\s*-?\s*rp/i, name: "SkyRP" },
  { re: /pohod[aá][řr]/i, name: "Pohodáři" },
  { re: /gen\s*-?\s*k/i, name: "GenK 3.0" },
];

export const isFivem = (game: string | null | undefined) => (game ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "").includes("fivem");

function clean(raw: string): string {
  return raw
    .replace(/\^\d/g, "") // barevné kódy FiveM (^1, ^2...)
    .replace(/~[a-z]~/gi, "")
    .replace(/^\s*(playing on|connected to|hraje na|hraje|on)\s+/i, "")
    .replace(/[\[(]\s*\d+\s*\/\s*\d+\s*[\])]/g, "") // (12/128)
    .replace(/\s+\d+\s*\/\s*\d+\s*(players|hráčů)?\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 60);
}

/** Název serveru, na kterém hráč ve FiveM je, nebo null. */
export function fivemServer(details?: string | null, state?: string | null): string | null {
  const raw = [details, state].filter((x): x is string => !!x && x.trim().length > 0);
  const parts = raw.map(clean).filter((x) => x.length >= 2 && !/^(idle|in menu|main menu|menu|loading|connecting)$/i.test(x));
  for (const p of parts) {
    for (const k of KNOWN) if (k.re.test(p)) return k.name;
  }
  // Preferuj text, který vypadal jako "Playing on ...", jinak první použitelný
  const i = raw.findIndex((p) => /(playing on|connected to|hraje na)/i.test(p));
  const preferred = i >= 0 ? clean(raw[i]) : "";
  return (preferred.length >= 2 ? preferred : parts[0]) || null;
}

/** Klíč a název záznamu o odehraném čase: FiveM se počítá zvlášť pro každý server. */
export function playKey(game: string, details?: string | null, state?: string | null): { key: string; name: string } {
  if (isFivem(game)) {
    const s = fivemServer(details, state);
    if (s) return { key: `fivem:${s.toLowerCase().replace(/[^a-z0-9ěščřžýáíéúůťďňó]+/g, "")}`, name: `FiveM · ${s}` };
    return { key: "fivem", name: "FiveM" };
  }
  return { key: game.toLowerCase().replace(/[^a-z0-9]+/g, ""), name: game };
}
