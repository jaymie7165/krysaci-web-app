import { cached } from "@/lib/cache";

/**
 * Valorant data. Oficiální Riot API pro Valorant vyžaduje schválený produkční klíč a souhlas hráče,
 * proto se tady používá neoficiální služba HenrikDev a zobrazují se VÝHRADNĚ data hráčů,
 * kteří si účet sami propojili a výslovně zapnuli sdílení (LinkedAccount.shareValorant).
 */
export type ValorantRank = {
  tier: string;
  rr: number;
  peak: string | null;
  lastChange: number;
  seasons: { season: string; wins: number; games: number; tier: string }[];
};

async function load(name: string, tag: string): Promise<ValorantRank> {
  const key = process.env.HENRIK_API_KEY;
  if (!key) throw new Error("HENRIK_API_KEY není nastaven");
  const res = await fetch(
    `https://api.henrikdev.xyz/valorant/v3/mmr/eu/pc/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
    { headers: { Authorization: key }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Valorant API ${res.status}`);
  const j = await res.json();
  const d = j?.data;
  return {
    tier: d?.current?.tier?.name ?? "Unrated",
    rr: d?.current?.rr ?? 0,
    peak: d?.peak?.tier?.name ?? null,
    lastChange: d?.current?.last_change ?? 0,
    seasons: (d?.seasonal ?? [])
      .slice(-4)
      .map((s: { season?: { short?: string }; wins?: number; games?: number; end_tier?: { name?: string } }) => ({
        season: s.season?.short ?? "",
        wins: s.wins ?? 0,
        games: s.games ?? 0,
        tier: s.end_tier?.name ?? "",
      })),
  };
}

export function getValorantRank(name: string, tag: string) {
  return cached(`val:${name.toLowerCase()}#${tag.toLowerCase()}`, 900, () => load(name, tag));
}

/** Poslední hry hráče pro odměny peta. Odpověď se čte opatrně (v3 i v4 formát HenrikDev). */
export async function getValorantMatches(name: string, tag: string): Promise<{ id: string; endedAt: number; ok: boolean }[]> {
  const key = process.env.HENRIK_API_KEY;
  if (!key) return [];
  const res = await fetch(`https://api.henrikdev.xyz/valorant/v3/matches/eu/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=5`, {
    headers: { Authorization: key },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Valorant API ${res.status}`);
  const j = await res.json();
  const out: { id: string; endedAt: number; ok: boolean }[] = [];
  for (const m of j?.data ?? []) {
    const md = m?.metadata ?? {};
    const id = md.matchid ?? md.match_id;
    if (!id) continue;
    const startRaw = md.game_start ?? md.started_at;
    const start = typeof startRaw === "number" ? startRaw * (startRaw < 1e12 ? 1000 : 1) : Date.parse(String(startRaw ?? ""));
    const len = Number(md.game_length ?? md.game_length_in_ms ?? 0); // ms
    const rounds = Number(md.rounds_played ?? (Array.isArray(m?.rounds) ? m.rounds.length : 0));
    if (!Number.isFinite(start)) continue;
    out.push({ id: String(id), endedAt: start + len, ok: rounds >= 5 || (rounds === 0 && len >= 5 * 60 * 1000) });
  }
  return out;
}
