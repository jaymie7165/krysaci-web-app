import { db } from "@/lib/db";
import { DEFAULT_PLATFORM, getLiveBrief } from "@/lib/riot";
import { getSteamNowPlaying } from "@/lib/steam";
import { fivemServer, isFivem, playKey } from "@/lib/fivem";

export type LiveEntry = {
  userId: string;
  handle: string;
  username: string;
  avatarUrl: string | null;
  game: string; // název hry
  source: "lol" | "steam" | "discord";
  detail?: string; // např. "Ranked Solo/Duo, Ahri" nebo server ve FiveM
  details?: string | null; // surový text hry (pro výpočet klíče času)
  state?: string | null;
  since?: number; // kdy hra začala (ms)
  totalSec?: number; // celkový čas ve hře, který web zaznamenal
};

const STALE_MS = 10 * 60 * 1000; // data z bota starší než 10 minut ignorujeme

/** Normalizovaný název hry, aby "VALORANT" z Discordu a ze Steamu dopadlo na stejnou položku. */
export const normGame = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

type DiscordSnapshot = { updatedAt: number; players: { discordId: string; game: string | null; details?: string | null; state?: string | null; startedAt?: number | null }[] };

/**
 * Kdo právě hraje. Zdroje podle priority: LoL živá hra, Steam, Discord (posílá bot).
 * Ukazují se jen hráči, kteří to mají povolené (User.showActivity).
 */
async function computeLiveNow(): Promise<LiveEntry[]> {
  const out = new Map<string, LiveEntry>();

  const users = await db.user.findMany({
    where: { showActivity: true },
    select: { id: true, discordId: true, handle: true, username: true, avatarUrl: true, linkedAccounts: true },
    take: 500,
  }).catch(() => []);
  type U = (typeof users)[number];
  const base = (u: U) => ({ userId: u.id, handle: u.handle, username: u.username, avatarUrl: u.avatarUrl });

  // 1. Discord (od bota)
  const row = await db.statCache.findUnique({ where: { key: "presence:discord" } }).catch(() => null);
  const snap = row?.data as DiscordSnapshot | undefined;
  if (snap && Date.now() - snap.updatedAt < STALE_MS) {
    const byDiscord = new Map(snap.players.filter((p) => p.game).map((p) => [p.discordId, p]));
    for (const u of users) {
      const p = byDiscord.get(u.discordId);
      if (p?.game) {
        // details/state posílá samotná hra (Competitive, název FiveM serveru...)
        const server = isFivem(p.game) ? fivemServer(p.details, p.state) : null;
        const detail = server ? `Server ${server}` : [p.details, p.state].filter(Boolean).join(" · ") || undefined;
        out.set(u.id, { ...base(u), game: p.game, source: "discord", detail, since: p.startedAt ?? undefined, details: p.details, state: p.state });
      }
    }
  }

  // 2. Steam (přepíše Discord, bývá přesnější)
  const steamUsers = users.filter((u: U) => u.linkedAccounts.some((a: { provider: string }) => a.provider === "steam"));
  const steamIds = steamUsers.map((u: U) => u.linkedAccounts.find((a: { provider: string }) => a.provider === "steam")!.externalId);
  const now = await withTimeout(getSteamNowPlaying(steamIds), 2500, {} as Record<string, string>);
  for (const u of steamUsers as U[]) {
    const sid = u.linkedAccounts.find((a: { provider: string }) => a.provider === "steam")!.externalId;
    if (now[sid]) {
      const d = out.get(u.id);
      // Když Discord ukazuje stejnou hru, zachováme jeho podrobnosti (režim, server) a čas začátku.
      const same = d && normGame(d.game) === normGame(now[sid]);
      out.set(u.id, { ...base(u), game: now[sid], source: "steam", detail: same ? d.detail : undefined, since: same ? d.since : undefined, details: same ? d.details : undefined, state: same ? d.state : undefined });
    }
  }

  // 3. LoL živá hra (jen ověřené Riot účty, nejvýš 25 kvůli limitům Riotu)
  if (process.env.RIOT_API_KEY) {
    const riotAccs = (users as U[])
      .flatMap((u) => u.linkedAccounts.filter((a: { provider: string; verified: boolean }) => a.provider === "riot" && a.verified).map((a) => [u, a] as const))
      .slice(0, 40);
    const briefs = await withTimeout(
      Promise.all(
        riotAccs.map(async ([u, a]) => {
          const g = await getLiveBrief(a.externalId, a.region ?? DEFAULT_PLATFORM).catch(() => null);
          return [u, g] as const;
        })
      ),
      3000,
      [] as (readonly [U, Awaited<ReturnType<typeof getLiveBrief>>])[]
    );
    for (const [u, g] of briefs) {
      if (g) {
        out.set(u.id, {
          ...base(u),
          game: "League of Legends",
          source: "lol",
          detail: g.championName ? `${g.queue}, ${g.championName}` : g.queue,
          since: g.startedAt,
        });
      }
    }
  }

  const list = [...out.values()];

  // Hra, u které Discord ani Riot neřekly začátek: počítáme od chvíle, kdy jsme hráče u ní poprvé zahlédli.
  const present = new Set(list.map((e) => e.userId));
  for (const k of [...seen.keys()]) if (!present.has(k.split("|")[0])) seen.delete(k);
  for (const e of list) {
    const k = `${e.userId}|${normGame(e.game)}`;
    for (const o of [...seen.keys()]) if (o.startsWith(e.userId + "|") && o !== k) seen.delete(o);
    if (!seen.has(k)) seen.set(k, Date.now());
    e.since ??= seen.get(k);
  }

  // Celkový čas ve hře (z dat bota)
  if (list.length) {
    const rows = await db.playTime.findMany({ where: { userId: { in: list.map((e) => e.userId) } }, select: { userId: true, gameKey: true, seconds: true } }).catch(() => []);
    const tot = new Map(rows.map((r: { userId: string; gameKey: string; seconds: number }) => [`${r.userId}|${r.gameKey}`, r.seconds]));
    for (const e of list) {
      const sec = tot.get(`${e.userId}|${playKey(e.game, e.details, e.state).key}`);
      if (sec) e.totalSec = sec;
    }
  }
  return list;
}

const seen = new Map<string, number>();

/**
 * Kdo právě hraje, s pamětí na 30 s: web se nemusí při každém zobrazení ptát Steamu a Riotu.
 * Po vypršení vrátí starou hodnotu hned a obnoví ji na pozadí (stránka nečeká na cizí servery).
 */
let liveMemo: { at: number; data: LiveEntry[] } | null = null;
let liveInflight: Promise<LiveEntry[]> | null = null;
function refreshLive() {
  liveInflight ??= computeLiveNow()
    .then((data) => { liveMemo = { at: Date.now(), data }; return data; })
    .finally(() => { liveInflight = null; });
  return liveInflight;
}
export async function getLiveNow(): Promise<LiveEntry[]> {
  if (liveMemo && Date.now() - liveMemo.at < 30_000) return liveMemo.data;
  if (liveMemo) { refreshLive().catch(() => {}); return liveMemo.data; }
  return refreshLive();
}
