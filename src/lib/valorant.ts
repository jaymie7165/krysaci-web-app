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
