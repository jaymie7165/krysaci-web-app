import { db } from "@/lib/db";
import { DEFAULT_PLATFORM, getLiveBrief } from "@/lib/riot";
import { getSteamNowPlaying } from "@/lib/steam";

export type LiveEntry = {
  userId: string;
  handle: string;
  username: string;
  avatarUrl: string | null;
  game: string; // název hry
  source: "lol" | "steam" | "discord";
  detail?: string; // např. "Ranked Solo/Duo, Ahri"
  since?: number;
};

const STALE_MS = 10 * 60 * 1000; // data z bota starší než 10 minut ignorujeme

/** Normalizovaný název hry, aby "VALORANT" z Discordu a ze Steamu dopadlo na stejnou položku. */
export const normGame = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

type DiscordSnapshot = { updatedAt: number; players: { discordId: string; game: string | null }[] };

/**
 * Kdo právě hraje. Zdroje podle priority: LoL živá hra, Steam, Discord (posílá bot).
 * Ukazují se jen hráči, kteří to mají povolené (User.showActivity).
 */
export async function getLiveNow(): Promise<LiveEntry[]> {
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
    const byDiscord = new Map(snap.players.filter((p) => p.game).map((p) => [p.discordId, p.game as string]));
    for (const u of users) {
      const g = byDiscord.get(u.discordId);
      if (g) out.set(u.id, { ...base(u), game: g, source: "discord" });
    }
  }

  // 2. Steam (přepíše Discord, bývá přesnější)
  const steamUsers = users.filter((u: U) => u.linkedAccounts.some((a: { provider: string }) => a.provider === "steam"));
  const steamIds = steamUsers.map((u: U) => u.linkedAccounts.find((a: { provider: string }) => a.provider === "steam")!.externalId);
  const now = await withTimeout(getSteamNowPlaying(steamIds), 2500, {} as Record<string, string>);
  for (const u of steamUsers as U[]) {
    const sid = u.linkedAccounts.find((a: { provider: string }) => a.provider === "steam")!.externalId;
    if (now[sid]) out.set(u.id, { ...base(u), game: now[sid], source: "steam" });
  }

  // 3. LoL živá hra (jen ověřené Riot účty, nejvýš 25 kvůli limitům Riotu)
  if (process.env.RIOT_API_KEY) {
    const riotUsers = (users as U[])
      .filter((u) => u.linkedAccounts.some((a: { provider: string; verified: boolean }) => a.provider === "riot" && a.verified))
      .slice(0, 25);
    const briefs = await withTimeout(
      Promise.all(
        riotUsers.map(async (u) => {
          const a = u.linkedAccounts.find((x: { provider: string }) => x.provider === "riot")!;
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

  return [...out.values()];
}
