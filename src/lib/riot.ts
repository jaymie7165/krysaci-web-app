import { cached } from "@/lib/cache";
import { db } from "@/lib/db";

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

/* ---------- Data Dragon (obrázky a názvy) ---------- */

type Champion = { id: string; key: string; name: string; tags: string[]; info: { attack: number; defense: number; magic: number } };
type RuneStyle = { id: number; icon: string; slots: { runes: { id: number; icon: string }[] }[] };

export type DData = {
  version: string;
  champs: Record<string, Champion>; // podle číselného klíče
  spells: Record<string, string>; // id kouzla -> název souboru (SummonerFlash)
  runes: Record<string, string>; // id runy/stromu -> cesta ikony
};

export async function ddragon(): Promise<DData> {
  return cached("ddragon:v4", 60 * 60 * 12, async () => {
    const versions: string[] = await (await fetch("https://ddragon.leagueoflegends.com/api/versions.json")).json();
    const version = versions[0];
    const base = `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US`;
    const [champJson, spellJson, runeJson] = await Promise.all([
      fetch(`${base}/champion.json`).then((r) => r.json()),
      fetch(`${base}/summoner.json`).then((r) => r.json()).catch(() => ({ data: {} })),
      fetch(`${base}/runesReforged.json`).then((r) => r.json()).catch(() => []),
    ]);
    const champs: DData["champs"] = {};
    for (const c of Object.values(champJson.data) as Champion[]) champs[c.key] = { id: c.id, key: c.key, name: c.name, tags: c.tags ?? [], info: c.info ?? { attack: 5, defense: 5, magic: 5 } };
    const spells: DData["spells"] = {};
    for (const s of Object.values(spellJson.data ?? {}) as { id: string; key: string }[]) spells[s.key] = s.id;
    const runes: DData["runes"] = {};
    for (const st of runeJson as RuneStyle[]) {
      runes[String(st.id)] = st.icon;
      for (const slot of st.slots) for (const r of slot.runes) runes[String(r.id)] = r.icon;
    }
    return { version, champs, spells, runes };
  });
}

export const QUEUES: Record<number, string> = {
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

/** Hráč v jednom zápase. Ukládá se jen s ID, obrázky se skládají až při zobrazení. */
export type MatchPlayer = {
  puuid: string;
  name: string;
  championId: number;
  champion: string; // ID pro Data Dragon (např. "MonkeyKing")
  champLevel: number;
  teamId: number;
  role: string; // TOP | JUNGLE | MIDDLE | BOTTOM | UTILITY | ""
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damage: number;
  vision: number;
  win: boolean;
  items: number[]; // 7 slotů, 0 = prázdný
  spells: [number, number];
  keystone: number;
  secondaryStyle: number;
  multikill: number;
};

export type LolMatch = {
  id: string;
  queue: string;
  playedAt: number;
  seconds: number;
  remake: boolean;
  win: boolean;
  me: MatchPlayer;
  players: MatchPlayer[];
};

export type LolProfile = {
  puuid: string;
  gameName: string;
  tagLine: string;
  platform: string;
  level: number;
  iconId: number;
  solo: RankEntry | null;
  flex: RankEntry | null;
  mastery: { championId: number; champion: string; name: string; level: number; points: number }[];
  matches: LolMatch[];
  requested: number; // kolik zápasů se chtělo načíst
  partial: boolean; // některé se nepodařilo načíst (limit Riotu)
  dd: DData;
};

export type LivePlayer = {
  puuid: string;
  name: string;
  teamId: number;
  championId: number;
  champion: string;
  championName: string;
  spells: [number, number];
  rank: RankEntry | null;
};
export type LiveGame = {
  queue: string;
  startedAt: number;
  seconds: number;
  players: LivePlayer[];
  bans: { teamId: number; champion: string }[];
};

/* ---------- Účty ---------- */

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

/* ---------- Zápasy ---------- */

type RawParticipant = {
  puuid: string;
  riotIdGameName?: string;
  riotIdTagline?: string;
  summonerName?: string;
  championId: number;
  championName: string;
  champLevel: number;
  teamId: number;
  teamPosition?: string;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
  visionScore: number;
  win: boolean;
  item0: number; item1: number; item2: number; item3: number; item4: number; item5: number; item6: number;
  summoner1Id: number;
  summoner2Id: number;
  largestMultiKill?: number;
  gameEndedInEarlySurrender?: boolean;
  perks?: { styles?: { description: string; style: number; selections?: { perk: number }[] }[] };
};

type StoredMatch = {
  id: string;
  queueId: number;
  playedAt: number;
  seconds: number;
  remake: boolean;
  players: MatchPlayer[];
};

function toPlayer(p: RawParticipant, champs: DData["champs"]): MatchPlayer {
  const primary = p.perks?.styles?.find((s) => s.description === "primaryStyle");
  const sub = p.perks?.styles?.find((s) => s.description === "subStyle");
  return {
    puuid: p.puuid,
    name: p.riotIdGameName ? `${p.riotIdGameName}#${p.riotIdTagline ?? ""}` : p.summonerName || "?",
    championId: p.championId,
    champion: champs[String(p.championId)]?.id ?? p.championName,
    champLevel: p.champLevel,
    teamId: p.teamId,
    role: p.teamPosition ?? "",
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    cs: p.totalMinionsKilled + p.neutralMinionsKilled,
    gold: p.goldEarned,
    damage: p.totalDamageDealtToChampions,
    vision: p.visionScore,
    win: p.win,
    items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
    spells: [p.summoner1Id, p.summoner2Id],
    keystone: primary?.selections?.[0]?.perk ?? 0,
    secondaryStyle: sub?.style ?? 0,
    multikill: p.largestMultiKill ?? 0,
  };
}

/** Jeden zápas se nikdy nemění, proto se cachuje na 30 dní a opakované zobrazení nestojí žádné dotazy. */
function loadMatch(region: string, id: string, champs: DData["champs"]): Promise<StoredMatch> {
  return cached(`m5:${id}`, 60 * 60 * 24 * 30, async () => {
    const m = await riot<{
      info: { gameCreation: number; gameDuration: number; queueId: number; participants: RawParticipant[] };
    }>(region, `/lol/match/v5/matches/${id}`);
    // gameDuration je v sekundách (u nových zápasů); starší záznamy byly v milisekundách
    const seconds = m.info.gameDuration > 100000 ? Math.round(m.info.gameDuration / 1000) : m.info.gameDuration;
    return {
      id,
      queueId: m.info.queueId,
      playedAt: m.info.gameCreation,
      seconds,
      remake: seconds < 240 || m.info.participants.some((p) => p.gameEndedInEarlySurrender),
      players: m.info.participants.map((p) => toPlayer(p, champs)),
    };
  });
}

async function inBatches<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>) {
  const out: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.allSettled(items.slice(i, i + size).map(fn))));
  }
  return out;
}

/* ---------- Rank a historie ---------- */

type RawEntry = { queueType: string; tier: string; rank: string; leaguePoints: number; wins: number; losses: number };

const toRank = (entries: RawEntry[], q: string): RankEntry | null => {
  const e = entries.find((x) => x.queueType === q);
  return e ? { tier: e.tier, division: e.rank, lp: e.leaguePoints, wins: e.wins, losses: e.losses } : null;
};

/** Solo rank libovolného hráče (cache 30 minut), používá se u živé hry. */
export function getSoloRank(puuid: string, platform: string) {
  return cached<RankEntry | null>(`rank:${platform}:${puuid}`, 1800, async () => {
    const entries = await riot<RawEntry[]>(platform, `/lol/league/v4/entries/by-puuid/${puuid}`);
    return toRank(entries, "RANKED_SOLO_5x5");
  });
}

/** Uloží rank do historie, ale jen když se změnil nebo je poslední záznam starší než 3 hodiny. */
export async function recordSnapshots(puuid: string, solo: RankEntry | null, flex: RankEntry | null) {
  for (const [queue, r] of [["RANKED_SOLO_5x5", solo], ["RANKED_FLEX_SR", flex]] as const) {
    if (!r) continue;
    try {
      const last = await db.rankSnapshot.findFirst({ where: { puuid, queue }, orderBy: { takenAt: "desc" } });
      const same =
        last &&
        last.tier === r.tier && last.division === r.division && last.lp === r.lp &&
        last.wins === r.wins && last.losses === r.losses;
      const fresh = last && Date.now() - last.takenAt.getTime() < 3 * 3600 * 1000;
      if (same && fresh) continue; // beze změny a nedávno uloženo
      await db.rankSnapshot.create({ data: { puuid, queue, ...snap(r) } });
    } catch {
      /* historie je doplněk, chyba ukládání nesmí rozbít profil */
    }
  }
}
const snap = (r: RankEntry) => ({ tier: r.tier, division: r.division, lp: r.lp, wins: r.wins, losses: r.losses });

export async function getRankHistory(puuid: string, queue = "RANKED_SOLO_5x5") {
  try {
    return await db.rankSnapshot.findMany({ where: { puuid, queue }, orderBy: { takenAt: "asc" }, take: 300 });
  } catch {
    return [];
  }
}

/* ---------- Profil ---------- */

async function loadProfile(
  puuid: string,
  gameName: string,
  tagLine: string,
  platform: string,
  count: number
): Promise<LolProfile> {
  const region = (PLATFORMS[platform] ?? PLATFORMS[DEFAULT_PLATFORM]).region;
  const dd = await ddragon();

  const [summoner, entries, masteryRaw, ids] = await Promise.all([
    riot<{ profileIconId: number; summonerLevel: number }>(platform, `/lol/summoner/v4/summoners/by-puuid/${puuid}`),
    riot<RawEntry[]>(platform, `/lol/league/v4/entries/by-puuid/${puuid}`).catch(() => [] as RawEntry[]),
    riot<{ championId: number; championLevel: number; championPoints: number }[]>(
      platform,
      `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=7`
    ).catch(() => []),
    riot<string[]>(region, `/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`).catch(() => [] as string[]),
  ]);

  const settled = await inBatches(ids, 5, (id) => loadMatch(region, id, dd.champs));

  const matches: LolMatch[] = [];
  let partial = false;
  for (const r of settled) {
    if (r.status !== "fulfilled") {
      partial = true;
      continue;
    }
    const m = r.value;
    const queue = QUEUES[m.queueId];
    // Vlastní hry (customky) se bez souhlasu hráče veřejně neukazují.
    if (!queue) continue;
    const me = m.players.find((p) => p.puuid === puuid);
    if (!me) continue;
    matches.push({ id: m.id, queue, playedAt: m.playedAt, seconds: m.seconds, remake: m.remake, win: me.win, me, players: m.players });
  }
  matches.sort((a, b) => b.playedAt - a.playedAt);

  const solo = toRank(entries, "RANKED_SOLO_5x5");
  const flex = toRank(entries, "RANKED_FLEX_SR");
  await recordSnapshots(puuid, solo, flex);

  return {
    puuid,
    gameName,
    tagLine,
    platform,
    level: summoner.summonerLevel,
    iconId: summoner.profileIconId,
    solo,
    flex,
    mastery: masteryRaw.map((m) => {
      const c = dd.champs[String(m.championId)];
      return { championId: m.championId, champion: c?.id ?? "", name: c?.name ?? `#${m.championId}`, level: m.championLevel, points: m.championPoints };
    }),
    matches,
    requested: count,
    partial,
    dd,
  };
}

/** Kompletní LoL profil (cache 10 minut). Jednotlivé zápasy jsou cachované zvlášť na 30 dní. */
export function getLolProfile(puuid: string, gameName: string, tagLine: string, platform: string, count = 20) {
  const n = count >= 50 ? 50 : 20;
  return cached(`lol:v2:${platform}:${puuid}:${n}`, 600, () => loadProfile(puuid, gameName, tagLine, platform, n));
}

/* ---------- Živá hra ---------- */

type RawLive = {
  gameStartTime: number;
  gameLength: number;
  gameQueueConfigId: number;
  participants: {
    puuid: string;
    teamId: number;
    championId: number;
    spell1Id: number;
    spell2Id: number;
    riotId?: string;
    summonerName?: string;
  }[];
  bannedChampions?: { championId: number; teamId: number }[];
};

/** Aktuální hra hráče, nebo null, když zrovna nehraje. Cache 1 minuta. */
export async function getLiveGame(puuid: string, platform: string): Promise<LiveGame | null> {
  const r = await cached<{ game: LiveGame | null }>(`live:${platform}:${puuid}`, 60, async () => ({
    game: await loadLiveGame(puuid, platform),
  }));
  return r.game;
}

async function loadLiveGame(puuid: string, platform: string): Promise<LiveGame | null> {
  {
    let g: RawLive;
    try {
      g = await riot<RawLive>(platform, `/lol/spectator/v5/active-games/by-summoner/${puuid}`);
    } catch (e) {
      if (e instanceof RiotError && e.status === 404) return null; // zrovna nehraje
      throw e;
    }
    const dd = await ddragon();
    const ranks = await Promise.all(g.participants.map((p) => getSoloRank(p.puuid, platform).catch(() => null)));
    const players: LivePlayer[] = g.participants.map((p, i) => {
      const c = dd.champs[String(p.championId)];
      return {
        puuid: p.puuid,
        name: p.riotId || p.summonerName || "?",
        teamId: p.teamId,
        championId: p.championId,
        champion: c?.id ?? "",
        championName: c?.name ?? `#${p.championId}`,
        spells: [p.spell1Id, p.spell2Id],
        rank: ranks[i],
      };
    });
    return {
      queue: QUEUES[g.gameQueueConfigId] ?? "Game",
      startedAt: g.gameStartTime,
      seconds: g.gameLength,
      players,
      bans: (g.bannedChampions ?? [])
        .filter((b) => b.championId > 0)
        .map((b) => ({ teamId: b.teamId, champion: dd.champs[String(b.championId)]?.id ?? "" })),
    };
  }
}

/** Poslední uložený profil z cache (bez volání Riotu, libovolně starý). Pro rychlé zobrazení na hlavní stránce. */
export async function peekLolProfile(puuid: string, platform: string): Promise<LolProfile | null> {
  try {
    const row = await db.statCache.findUnique({ where: { key: `lol:v2:${platform}:${puuid}:20` } });
    return (row?.data as LolProfile | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Stručná informace "hraje LoL" pro přehled komunity: jeden dotaz, cache 2 minuty. */
export async function getLiveBrief(puuid: string, platform: string) {
  const r = await cached<{ game: { queue: string; startedAt: number; champion: string; championName: string } | null }>(
    `livebrief:${platform}:${puuid}`,
    120,
    async () => {
      try {
        const g = await riot<RawLive>(platform, `/lol/spectator/v5/active-games/by-summoner/${puuid}`);
        const me = g.participants.find((p) => p.puuid === puuid);
        const dd = await ddragon();
        const c = me ? dd.champs[String(me.championId)] : undefined;
        return {
          game: {
            queue: QUEUES[g.gameQueueConfigId] ?? "Game",
            startedAt: g.gameStartTime,
            champion: c?.id ?? "",
            championName: c?.name ?? "",
          },
        };
      } catch (e) {
        if (e instanceof RiotError && e.status === 404) return { game: null };
        throw e;
      }
    }
  );
  return r.game;
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

/* ---------- Scouting ---------- */

export type ScoutRecent = { id: string; win: boolean; champion: string; kills: number; deaths: number; assists: number; playedAt: number };
export type Scout = {
  puuid: string;
  recent: ScoutRecent[]; // posledních 5 ranked solo/duo
  top: { championId: number; champion: string; name: string; level: number; points: number }[];
};

/** Rychlý přehled hráče pro živou hru: posledních 5 ranked solo/duo her a nejhranější šampioni. Cache 15 minut. */
export function getScout(puuid: string, platform: string) {
  return cached<Scout>(`scout:v1:${platform}:${puuid}`, 900, async () => {
    const region = (PLATFORMS[platform] ?? PLATFORMS[DEFAULT_PLATFORM]).region;
    const dd = await ddragon();
    const [idsR, masteryR] = await Promise.allSettled([
      riot<string[]>(region, `/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=5`),
      riot<{ championId: number; championLevel: number; championPoints: number }[]>(
        platform,
        `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=3`
      ),
    ]);
    // Když Riot odmítl obě volání (limit, klíč), nic neukládáme do cache a hráč se ukáže jako nenačtený.
    if (idsR.status === "rejected" && masteryR.status === "rejected") throw idsR.reason;
    const ids = idsR.status === "fulfilled" ? idsR.value : [];
    const masteryRaw = masteryR.status === "fulfilled" ? masteryR.value : [];
    const settled = await inBatches(ids, 5, (id) => loadMatch(region, id, dd.champs));
    const recent: ScoutRecent[] = [];
    for (const r of settled) {
      if (r.status !== "fulfilled") continue;
      const me = r.value.players.find((p) => p.puuid === puuid);
      if (!me || r.value.remake) continue;
      recent.push({ id: r.value.id, win: me.win, champion: me.champion, kills: me.kills, deaths: me.deaths, assists: me.assists, playedAt: r.value.playedAt });
    }
    recent.sort((a, b) => b.playedAt - a.playedAt);
    return {
      puuid,
      recent,
      top: masteryRaw.map((m) => {
        const c = dd.champs[String(m.championId)];
        return { championId: m.championId, champion: c?.id ?? "", name: c?.name ?? `#${m.championId}`, level: m.championLevel, points: m.championPoints };
      }),
    };
  });
}

/** Scouting celé hry, po malých dávkách, aby se nevyčerpal limit Riot API. Hráči, které se nepodařilo načíst, chybí. */
export async function getScoutAll(puuids: string[], platform: string): Promise<Map<string, Scout>> {
  const out = new Map<string, Scout>();
  const settled = await inBatches(puuids, 3, (id) => getScout(id, platform));
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") out.set(puuids[i], r.value);
  });
  return out;
}

/** Riot ID (Jmeno#TAG) podle puuid, cache týden. Hráči si ho mohou změnit, proto ne déle. */
export function getRiotIdByPuuid(puuid: string, platform: string) {
  const region = (PLATFORMS[platform] ?? PLATFORMS[DEFAULT_PLATFORM]).region;
  return cached<string | null>(`riotid:${puuid}`, 7 * 24 * 3600, async () => {
    const a = await riot<{ gameName?: string; tagLine?: string }>(region, `/riot/account/v1/accounts/by-puuid/${puuid}`);
    return a.gameName ? `${a.gameName}#${a.tagLine ?? ""}` : null;
  });
}

/** Zobecněný build hráče na šampionovi z jeho načtených zápasů (runy, itemy, výhry). */
export function buildFromMatches(matches: LolMatch[], champion: string) {
  const games = matches.filter((m) => !m.remake && m.me.champion === champion);
  if (games.length === 0) return null;
  const top = <T,>(xs: T[], n: number) => {
    const m = new Map<T, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map((x) => x[0]);
  };
  return {
    games: games.length,
    wins: games.filter((g) => g.win).length,
    keystone: top(games.map((g) => g.me.keystone).filter(Boolean), 1)[0] ?? 0,
    secondary: top(games.map((g) => g.me.secondaryStyle).filter(Boolean), 1)[0] ?? 0,
    items: top(games.flatMap((g) => g.me.items.slice(0, 6)).filter(Boolean), 6),
  };
}

/** Poslední zápasy hráče v kompaktní podobě (pro odměny v petovi). Jedno volání na seznam + jedno na každý zápas. */
export type MatchBrief = { id: string; endedAt: number; durationSec: number; remake: boolean; puuids: string[]; mine: boolean };

export async function getMatchBriefs(puuid: string, platform: string, known: Set<string>, max = 6): Promise<MatchBrief[]> {
  const region = PLATFORMS[platform]?.region ?? "europe";
  const ids = await riot<string[]>(region, `/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10`);
  const out: MatchBrief[] = [];
  for (const id of ids.filter((i) => !known.has(i)).slice(0, max)) {
    try {
      const m = await riot<{
        info: { gameEndTimestamp?: number; gameStartTimestamp: number; gameDuration: number; participants: { puuid: string; gameEndedInEarlySurrender?: boolean }[] };
      }>(region, `/lol/match/v5/matches/${id}`);
      const me = m.info.participants.find((p) => p.puuid === puuid);
      const dur = m.info.gameDuration > 100000 ? Math.round(m.info.gameDuration / 1000) : m.info.gameDuration;
      out.push({
        id,
        endedAt: m.info.gameEndTimestamp ?? m.info.gameStartTimestamp + dur * 1000,
        durationSec: dur,
        remake: !!me?.gameEndedInEarlySurrender || dur < 300,
        puuids: m.info.participants.map((p) => p.puuid),
        mine: !!me,
      });
    } catch {
      /* zápas se zkusí příště */
    }
  }
  return out;
}
