import { cached } from "@/lib/cache";

/** Platformy LoL (server hry) a jejich regionální směrovač pro Account-v1 a Match-v5. */
export const PLATFORMS: Record<string, { label: string; region: "europe" | "americas" | "asia" }> = {
  eun1: { label: "EUNE", region: "europe" },
  euw1: { label: "EUW", region: "europe" },
  tr1: { label: "TR", region: "europe" },
  na1: { label: "NA", region: "americas" },
  kr: { label: "KR", region: "asia" },
};
export const DEFAULT_PLATFORM = "eun1"; // Česko a Slovensko hrají na EUNE

export class RiotError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function riot<T>(host: string, path: string): Promise<T> {
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new RiotError("RIOT_API_KEY není nastaven", 503);
  const res = await fetch(`https://${host}.api.riotgames.com${path}`, {
    headers: { "X-Riot-Token": key },
    cache: "no-store",
  });
  if (!res.ok) throw new RiotError(`Riot API ${res.status}`, res.status);
  return res.json() as Promise<T>;
}

/* ---------- Data Dragon (obrázky a názvy šampionů) ---------- */

type Champion = { id: string; key: string; name: string };

async function ddragon() {
  return cached("ddragon:v2", 60 * 60 * 12, async () => {
    const versions: string[] = await (await fetch("https://ddragon.leagueoflegends.com/api/versions.json")).json();
    const version = versions[0];
    const json = await (
      await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`)
    ).json();
    const byKey: Record<string, Champion> = {};
    for (const c of Object.values(json.data) as Champion[]) byKey[c.key] = { id: c.id, key: c.key, name: c.name };
    return { version, byKey };
  });
}

const QUEUES: Record<number, string> = {
  420: "Ranked Solo/Duo",
  440: "Ranked Flex",
  400: "Normal Draft",
  430: "Normal Blind",
  450: "ARAM",
  490: "Quickplay",
  700: "Clash",
  1700: "Arena",
};

/* ---------- Typy výstupu ---------- */

export type RankEntry = { tier: string; division: string; lp: number; wins: number; losses: number };
export type LolMatch = {
  id: string;
  champion: string;
  championIcon: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  minutes: number;
  queue: string;
  playedAt: number;
  remake: boolean;
};
export type LolProfile = {
  puuid: string;
  gameName: string;
  tagLine: string;
  platform: string;
  level: number;
  iconUrl: string;
  solo: RankEntry | null;
  flex: RankEntry | null;
  mastery: { name: string; icon: string; level: number; points: number }[];
  matches: LolMatch[];
};

/* ---------- Volání ---------- */

export function findAccount(gameName: string, tagLine: string, platform: string) {
  const p = PLATFORMS[platform] ?? PLATFORMS[DEFAULT_PLATFORM];
  return cached(`acc:${p.region}:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`, 3600, () =>
    riot<{ puuid: string; gameName: string; tagLine: string }>(
      p.region,
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    )
  );
}

export async function profileIconUrl(iconId: number) {
  const { version } = await ddragon();
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${iconId}.png`;
}

/** Aktuální ikona hráče přímo z Riotu (bez cache, používá se při ověření vlastnictví). */
export async function getProfileIconId(puuid: string, platform: string) {
  const s = await riot<{ profileIconId: number }>(platform, `/lol/summoner/v4/summoners/by-puuid/${puuid}`);
  return s.profileIconId;
}

export async function getProfileIcon(puuid: string, platform: string) {
  return profileIconUrl(await getProfileIconId(puuid, platform));
}

/** Základní ikony dostupné každému hráči. Jednu z nich hráč nastaví, aby dokázal, že účet je jeho. */
export const VERIFY_ICON_IDS = Array.from({ length: 28 }, (_, i) => i + 1);

async function loadProfile(puuid: string, gameName: string, tagLine: string, platform: string): Promise<LolProfile> {
  const region = (PLATFORMS[platform] ?? PLATFORMS[DEFAULT_PLATFORM]).region;
  const { version, byKey } = await ddragon();

  const [summoner, entries, mastery, ids] = await Promise.all([
    riot<{ profileIconId: number; summonerLevel: number }>(platform, `/lol/summoner/v4/summoners/by-puuid/${puuid}`),
    riot<{ queueType: string; tier: string; rank: string; leaguePoints: number; wins: number; losses: number }[]>(
      platform,
      `/lol/league/v4/entries/by-puuid/${puuid}`
    ).catch(() => []),
    riot<{ championId: number; championLevel: number; championPoints: number }[]>(
      platform,
      `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=5`
    ).catch(() => []),
    riot<string[]>(region, `/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=8`).catch(() => [] as string[]),
  ]);

  const toRank = (q: string): RankEntry | null => {
    const e = entries.find((x) => x.queueType === q);
    return e ? { tier: e.tier, division: e.rank, lp: e.leaguePoints, wins: e.wins, losses: e.losses } : null;
  };

  const settled = await Promise.allSettled(
    ids.map((id) =>
      riot<{
        info: {
          gameCreation: number;
          gameDuration: number;
          queueId: number;
          participants: {
            puuid: string;
            championName: string;
            kills: number;
            deaths: number;
            assists: number;
            win: boolean;
            totalMinionsKilled: number;
            neutralMinionsKilled: number;
            gameEndedInEarlySurrender?: boolean;
          }[];
        };
      }>(region, `/lol/match/v5/matches/${id}`).then((m) => ({ id, m }))
    )
  );

  const matches: LolMatch[] = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    const { id, m } = r.value;
    const me = m.info.participants.find((p) => p.puuid === puuid);
    if (!me) continue;
    // Vlastní hry (customky) se bez souhlasu hráče veřejně neukazují.
    if (!QUEUES[m.info.queueId]) continue;
    // gameDuration je v sekundách (u nových zápasů); starší záznamy byly v milisekundách
    const seconds = m.info.gameDuration > 100000 ? m.info.gameDuration / 1000 : m.info.gameDuration;
    matches.push({
      id,
      champion: me.championName,
      championIcon: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${me.championName}.png`,
      win: me.win,
      kills: me.kills,
      deaths: me.deaths,
      assists: me.assists,
      cs: me.totalMinionsKilled + me.neutralMinionsKilled,
      minutes: Math.round(seconds / 60),
      queue: QUEUES[m.info.queueId],
      playedAt: m.info.gameCreation,
      remake: !!me.gameEndedInEarlySurrender || seconds < 240,
    });
  }
  matches.sort((a, b) => b.playedAt - a.playedAt);

  return {
    puuid,
    gameName,
    tagLine,
    platform,
    level: summoner.summonerLevel,
    iconUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${summoner.profileIconId}.png`,
    solo: toRank("RANKED_SOLO_5x5"),
    flex: toRank("RANKED_FLEX_SR"),
    mastery: mastery.map((m) => {
      const c = byKey[String(m.championId)];
      return {
        name: c?.name ?? `#${m.championId}`,
        icon: c ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${c.id}.png` : "",
        level: m.championLevel,
        points: m.championPoints,
      };
    }),
    matches,
  };
}

/** Kompletní LoL profil (cache 10 minut kvůli limitům Riot API). */
export function getLolProfile(puuid: string, gameName: string, tagLine: string, platform: string) {
  return cached(`lol:${platform}:${puuid}`, 600, () => loadProfile(puuid, gameName, tagLine, platform));
}

/** Rozdělí "Jmeno#TAG" nebo "Jmeno-TAG" na dvě části. */
export function parseRiotId(input: string): { gameName: string; tagLine: string } | null {
  const raw = input.trim();
  const i = Math.max(raw.lastIndexOf("#"), raw.lastIndexOf("-"));
  if (i < 1) return null;
  const gameName = raw.slice(0, i).trim();
  const tagLine = raw.slice(i + 1).trim();
  if (!gameName || !/^[A-Za-z0-9]{2,5}$/.test(tagLine)) return null;
  return { gameName, tagLine };
}
