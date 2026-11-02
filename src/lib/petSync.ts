import { db } from "@/lib/db";
import { getMatchBriefs } from "@/lib/riot";
import { getValorantMatches } from "@/lib/valorant";
import { getSteamRecentAll } from "@/lib/steam";
import { GAME_REWARD, SOCIAL_DAILY_CAP } from "@/lib/pet";

const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(new Date());

/** Hráči, se kterými je uživatel spojený přes web: přátelé a lidé z jeho LFG, customek a turnajů. */
async function connectedUserIds(userId: string): Promise<Set<string>> {
  const out = new Set<string>();
  const [friends, myPosts, myJoins, myCustoms, myCustomEntries, myEntries] = await Promise.all([
    db.friendship.findMany({ where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] }, select: { requesterId: true, addresseeId: true } }),
    db.lfgPost.findMany({ where: { authorId: userId }, select: { id: true } }),
    db.lfgJoin.findMany({ where: { userId }, select: { postId: true } }),
    db.custom.findMany({ where: { hostId: userId }, select: { id: true } }),
    db.customEntry.findMany({ where: { userId }, select: { customId: true } }),
    db.tournamentEntry.findMany({ where: { userId }, select: { tournamentId: true } }),
  ]);
  friends.forEach((f) => out.add(f.requesterId === userId ? f.addresseeId : f.requesterId));
  const postIds = [...myPosts.map((p) => p.id), ...myJoins.map((j) => j.postId)];
  const customIds = [...myCustoms.map((c) => c.id), ...myCustomEntries.map((c) => c.customId)];
  const tIds = myEntries.map((e) => e.tournamentId);
  const [joins, posts, ce, ch, te] = await Promise.all([
    db.lfgJoin.findMany({ where: { postId: { in: postIds } }, select: { userId: true } }),
    db.lfgPost.findMany({ where: { id: { in: postIds } }, select: { authorId: true } }),
    db.customEntry.findMany({ where: { customId: { in: customIds } }, select: { userId: true } }),
    db.custom.findMany({ where: { id: { in: customIds } }, select: { hostId: true } }),
    db.tournamentEntry.findMany({ where: { tournamentId: { in: tIds } }, select: { userId: true } }),
  ]);
  [...joins.map((x) => x.userId), ...posts.map((x) => x.authorId), ...ce.map((x) => x.userId), ...ch.map((x) => x.hostId), ...te.map((x) => x.userId)].forEach((id) => out.add(id));
  out.delete(userId);
  return out;
}

/**
 * Projde nové zápasy ověřených Riot účtů a udělí odměny. Zápas musí skončit po adopci peta,
 * trvat aspoň 5 minut a nesmí být remake. Se spoluhráčem z komunity dostaneš dvojnásobek (denní strop).
 * Volá se při otevření stránky peta a nejvýš jednou za 5 minut.
 */
export type SyncResult = { gained: number; treats?: number; xp?: number; coins?: number; error?: string };

const STEAM_BLOCK_MIN = 30; // každá započatá půlhodina v jiné Steam hře = jedna odměna
const STEAM_DAILY_CAP = 8; // nejvýš tolik půlhodin denně (4 h), aby se nedalo krmit nečinností

/** Valorant: jedna odehraná hra = odměna jako v LoLu (data z HenrikDev, jen ověřené Riot účty). */
async function valorantRewards(userId: string, adoptedAt: Date): Promise<number> {
  if (!process.env.HENRIK_API_KEY) return 0;
  const accounts = await db.linkedAccount.findMany({ where: { userId, provider: "riot", verified: true, gameName: { not: null }, tagLine: { not: null } } });
  if (accounts.length === 0) return 0;
  const known = new Set((await db.petGame.findMany({ where: { userId, matchId: { startsWith: "val:" } }, select: { matchId: true }, orderBy: { createdAt: "desc" }, take: 200 })).map((g) => g.matchId));
  let games = 0;
  for (const a of accounts) {
    let list: { id: string; endedAt: number; ok: boolean }[] = [];
    try {
      list = await getValorantMatches(a.gameName!, a.tagLine!);
    } catch {
      continue;
    }
    for (const m of list) {
      const key = `val:${m.id}`;
      if (known.has(key)) continue;
      known.add(key);
      const ok = m.ok && m.endedAt >= adoptedAt.getTime();
      await db.petGame.create({ data: { userId, matchId: key, counted: ok, social: false } }).catch(() => null);
      if (ok) games++;
    }
  }
  return games;
}

/** Ostatní Steam hry: z rozdílu odehraného času (posledních 14 dní) se spočítají celé půlhodiny. První kontrola jen uloží výchozí stav. */
async function steamRewards(userId: string, allowed: number): Promise<number> {
  const acc = await db.linkedAccount.findFirst({ where: { userId, provider: "steam" } });
  if (!acc) return 0;
  const recent = await getSteamRecentAll(acc.externalId).catch(() => null);
  if (!recent) return 0;
  let blocks = 0;
  for (const g of recent) {
    const prev = await db.steamPlay.findUnique({ where: { userId_appId: { userId, appId: g.appId } } });
    if (!prev) {
      await db.steamPlay.create({ data: { userId, appId: g.appId, minutes: g.minutes2w, carry: 0 } }).catch(() => null);
      continue;
    }
    const delta = g.minutes2w - prev.minutes; // záporné = staré dny vypadly z okna, bereme jako nový základ
    const total = prev.carry + Math.max(0, delta);
    const got = Math.floor(total / STEAM_BLOCK_MIN);
    const take = Math.min(got, Math.max(0, allowed - blocks));
    blocks += take;
    await db.steamPlay.update({ where: { id: prev.id }, data: { minutes: g.minutes2w, carry: total % STEAM_BLOCK_MIN } });
  }
  return blocks;
}

/** `force` (aplikace po konci hry) povolí kontrolu po 30 s místo 5 minut. */
export async function syncPetGames(userId: string, opts: { force?: boolean } = {}): Promise<SyncResult> {
  const pet = await db.pet.findUnique({ where: { userId } });
  if (!pet) return { gained: 0 };
  if (pet.lastSyncAt && Date.now() - pet.lastSyncAt.getTime() < (opts.force ? 30_000 : 5 * 60 * 1000)) return { gained: 0 };
  await db.pet.update({ where: { userId }, data: { lastSyncAt: new Date() } });

  const accounts = await db.linkedAccount.findMany({ where: { userId, provider: "riot", verified: true } });
  const known = new Set((await db.petGame.findMany({ where: { userId }, select: { matchId: true }, orderBy: { createdAt: "desc" }, take: 500 })).map((g) => g.matchId));

  let gained = 0, treats = 0, xp = 0, coins = 0, socialCount = pet.socialDay === today() ? pet.socialCount : 0;
  let steamCount = pet.steamDay === today() ? pet.steamCount : 0;
  let connected: Set<string> | null = null;
  let error: string | undefined;
  try {
    for (const a of accounts) {
      const briefs = await getMatchBriefs(a.externalId, a.region ?? "eun1", known);
      for (const b of briefs) {
        known.add(b.id);
        const ok = b.mine && !b.remake && b.endedAt >= pet.adoptedAt.getTime();
        let social = false;
        if (ok) {
          const others = await db.linkedAccount.findMany({ where: { provider: "riot", verified: true, externalId: { in: b.puuids }, userId: { not: userId } }, select: { userId: true } });
          if (others.length) {
            connected ??= await connectedUserIds(userId);
            social = others.some((o) => connected!.has(o.userId)) && socialCount < SOCIAL_DAILY_CAP;
          }
        }
        await db.petGame.create({ data: { userId, matchId: b.id, counted: ok, social } }).catch(() => null);
        if (!ok) continue;
        const mult = social ? 2 : 1;
        if (social) socialCount++;
        treats += GAME_REWARD.treats;
        xp += GAME_REWARD.xp * mult;
        coins += GAME_REWARD.coins * mult;
        gained++;
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "riot";
  }

  // Valorant (1 hra = 1 odměna) a ostatní Steam hry (30 min = 1 odměna)
  const extra = await valorantRewards(userId, pet.adoptedAt).catch(() => 0);
  const steam = await steamRewards(userId, Math.max(0, STEAM_DAILY_CAP - steamCount)).catch(() => 0);
  steamCount += steam;
  const more = extra + steam;
  treats += more * GAME_REWARD.treats;
  xp += more * GAME_REWARD.xp;
  coins += more * GAME_REWARD.coins;
  gained += more;

  if (gained > 0) {
    await db.pet.update({
      where: { userId },
      data: { treats: { increment: treats }, xp: { increment: xp }, coins: { increment: coins }, socialDay: today(), socialCount, steamDay: today(), steamCount },
    });
  }
  if (gained === 0 && error) return { gained: 0, error };
  return { gained, treats, xp, coins };
}
