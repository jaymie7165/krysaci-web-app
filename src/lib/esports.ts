import { db } from "@/lib/db";
import { cached } from "@/lib/cache";

/**
 * Synchronizace esportových zápasů. Ruční zadávání adminem funguje vždy; synchronizace je bonus.
 *
 *  - VALORANT (VCT): dokumentované veřejné HenrikDev API /valorant/v1/esports/schedule.
 *  - LoL (LEC, Worlds, MSI…): neoficiální lolesports gateway. Potřebuje LOLESPORTS_API_KEY
 *    (veřejný klíč, který používá web lolesports.com) a nejde zaručit, že ho Riot nezmění.
 *    ID lig se dají přepsat v LOLESPORTS_LEAGUE_IDS (čárkou oddělená).
 */

type RawTeam = {
  name?: string;
  code?: string;
  icon?: string;
  image?: string;
  game_wins?: number;
  result?: { gameWins?: number } | null;
};

type Row = {
  externalId: string;
  game: "lol" | "valorant";
  league: string;
  stage: string | null;
  startsAt: Date;
  bestOf: number;
  teamA: string;
  teamB: string;
  logoA: string | null;
  logoB: string | null;
  scoreA: number | null;
  scoreB: number | null;
  status: "upcoming" | "live" | "finished";
};

const mapState = (s?: string): Row["status"] =>
  s === "completed" ? "finished" : s === "inProgress" ? "live" : "upcoming";

async function fetchValorant(): Promise<Row[]> {
  const res = await fetch("https://api.henrikdev.xyz/valorant/v1/esports/schedule", { cache: "no-store" });
  if (!res.ok) throw new Error(`VCT schedule ${res.status}`);
  const j = await res.json();
  const rows: Row[] = [];
  for (const m of j?.data ?? []) {
    const teams: RawTeam[] = m?.match?.teams ?? [];
    if (teams.length < 2 || !m?.match?.id || !m?.date) continue;
    const state = mapState(m.state);
    rows.push({
      externalId: `valorant:${m.match.id}`,
      game: "valorant",
      league: m.league?.name ?? "VCT",
      stage: m.tournament?.name ?? null,
      startsAt: new Date(m.date),
      bestOf: m.match?.game_type?.count ?? 1,
      teamA: teams[0].name ?? teams[0].code ?? "TBD",
      teamB: teams[1].name ?? teams[1].code ?? "TBD",
      logoA: teams[0].icon ?? null,
      logoB: teams[1].icon ?? null,
      scoreA: state === "upcoming" ? null : teams[0].game_wins ?? 0,
      scoreB: state === "upcoming" ? null : teams[1].game_wins ?? 0,
      status: state,
    });
  }
  return rows;
}

const DEFAULT_LOL_LEAGUES = [
  "98767991302996019", // LEC
  "98767975604431411", // Worlds
  "98767991325878492", // MSI
];

async function fetchLol(): Promise<Row[]> {
  const key = process.env.LOLESPORTS_API_KEY;
  if (!key) return [];
  const ids = (process.env.LOLESPORTS_LEAGUE_IDS?.split(",").map((s) => s.trim()).filter(Boolean)) ?? DEFAULT_LOL_LEAGUES;
  const rows: Row[] = [];
  for (const id of ids) {
    const res = await fetch(`https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=en-US&leagueId=${id}`, {
      headers: { "x-api-key": key },
      cache: "no-store",
    });
    if (!res.ok) continue;
    const j = await res.json();
    for (const e of j?.data?.schedule?.events ?? []) {
      const teams: RawTeam[] = e?.match?.teams ?? [];
      if (e?.type !== "match" || teams.length < 2 || !e?.match?.id || !e?.startTime) continue;
      const state = mapState(e.state);
      rows.push({
        externalId: `lol:${e.match.id}`,
        game: "lol",
        league: e.league?.name ?? "LoL Esports",
        stage: e.blockName ?? null,
        startsAt: new Date(e.startTime),
        bestOf: e.match?.strategy?.count ?? 1,
        teamA: teams[0].name ?? teams[0].code ?? "TBD",
        teamB: teams[1].name ?? teams[1].code ?? "TBD",
        logoA: teams[0].image ?? null,
        logoB: teams[1].image ?? null,
        scoreA: state === "upcoming" ? null : teams[0].result?.gameWins ?? 0,
        scoreB: state === "upcoming" ? null : teams[1].result?.gameWins ?? 0,
        status: state,
      });
    }
  }
  return rows;
}

/** Stáhne zápasy a uloží je. Vrací počet uložených zápasů. Zápasy zadané ručně se nikdy nepřepisují. */
export async function syncEsports(): Promise<{ saved: number; errors: string[] }> {
  const errors: string[] = [];
  const all: Row[] = [];
  for (const [name, fn] of [["VCT", fetchValorant], ["LoL", fetchLol]] as const) {
    try {
      all.push(...(await fn()));
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : "chyba"}`);
    }
  }
  let saved = 0;
  for (const r of all) {
    if (isNaN(r.startsAt.getTime())) continue;
    const { externalId, ...data } = r;
    await db.esportsMatch
      .upsert({
        where: { externalId },
        update: { ...data, source: "sync" },
        create: { externalId, ...data, source: "sync" },
      })
      .then(() => saved++)
      .catch(() => null);
  }
  return { saved, errors };
}

/** Synchronizace nejvýše jednou za 30 minut, spouští se při otevření stránky Esport. */
export async function maybeSyncEsports() {
  try {
    await Promise.race([
      cached("esports:lastsync", 30 * 60, async () => {
        const r = await syncEsports();
        return { at: Date.now(), ...r };
      }),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
  } catch {
    /* stránka se zobrazí i bez synchronizace */
  }
}
