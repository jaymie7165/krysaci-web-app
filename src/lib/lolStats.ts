import type { MatchFull, Participant, RankEntry } from "@/lib/riot";

/** Funkce pro výpočty ze zápasů. Žádné volání API ani databáze, dají se použít kdekoliv. */

export function me(m: MatchFull, puuid: string): Participant | undefined {
  return m.participants.find((p) => p.puuid === puuid);
}

export const ROLE_LABEL: Record<string, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "ADC",
  UTILITY: "Support",
};

export type ChampStat = {
  champion: string;
  icon: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  minutes: number;
};

export type Summary = {
  games: number;
  wins: number;
  losses: number;
  kda: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  csPerMin: number;
  killParticipation: number;
  roles: { role: string; games: number; wins: number }[];
  champions: ChampStat[];
};

export const kdaOf = (k: number, d: number, a: number) => (d === 0 ? k + a : (k + a) / d);

/** Souhrn ze zápasů hráče. Remaky se nepočítají. */
export function summarize(matches: MatchFull[], puuid: string): Summary {
  const played = matches.filter((m) => !m.remake);
  let k = 0, d = 0, a = 0, cs = 0, min = 0, wins = 0, teamKills = 0, myKA = 0;
  const roles = new Map<string, { games: number; wins: number }>();
  const champs = new Map<string, ChampStat>();

  for (const m of played) {
    const p = me(m, puuid);
    if (!p) continue;
    k += p.kills; d += p.deaths; a += p.assists; cs += p.cs; min += m.minutes;
    if (p.win) wins++;
    teamKills += m.teams.find((t) => t.teamId === p.teamId)?.kills ?? 0;
    myKA += p.kills + p.assists;

    if (p.position) {
      const r = roles.get(p.position) ?? { games: 0, wins: 0 };
      r.games++; if (p.win) r.wins++;
      roles.set(p.position, r);
    }
    const c = champs.get(p.champion) ?? {
      champion: p.champion, icon: p.championIcon, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, cs: 0, minutes: 0,
    };
    c.games++; if (p.win) c.wins++;
    c.kills += p.kills; c.deaths += p.deaths; c.assists += p.assists; c.cs += p.cs; c.minutes += m.minutes;
    champs.set(p.champion, c);
  }

  const n = Math.max(played.length, 1);
  return {
    games: played.length,
    wins,
    losses: played.length - wins,
    kda: kdaOf(k, d, a),
    avgKills: k / n,
    avgDeaths: d / n,
    avgAssists: a / n,
    csPerMin: min ? cs / min : 0,
    killParticipation: teamKills ? myKA / teamKills : 0,
    roles: [...roles.entries()].map(([role, v]) => ({ role, ...v })).sort((x, y) => y.games - x.games),
    champions: [...champs.values()].sort((x, y) => y.games - x.games || y.wins - x.wins),
  };
}

/* ---------- Rank jako číslo pro graf ---------- */

const TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"];
const DIVS: Record<string, number> = { IV: 0, III: 1, II: 2, I: 3 };

export function lpScore(tier: string, division: string, lp: number) {
  const i = TIERS.indexOf(tier.toUpperCase());
  if (i === -1) return 2800 + lp; // Master a výš
  return i * 400 + (DIVS[division] ?? 0) * 100 + lp;
}

export function rankLabel(r: Pick<RankEntry, "tier" | "division">) {
  const t = r.tier[0] + r.tier.slice(1).toLowerCase();
  return ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(r.tier) ? t : `${t} ${r.division}`;
}
