import { db } from "@/lib/db";
import { getMatchBriefs } from "@/lib/riot";
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
export async function syncPetGames(userId: string): Promise<{ gained: number; error?: string }> {
  const pet = await db.pet.findUnique({ where: { userId } });
  if (!pet) return { gained: 0 };
  if (pet.lastSyncAt && Date.now() - pet.lastSyncAt.getTime() < 5 * 60 * 1000) return { gained: 0 };
  await db.pet.update({ where: { userId }, data: { lastSyncAt: new Date() } });

  const accounts = await db.linkedAccount.findMany({ where: { userId, provider: "riot", verified: true } });
  if (accounts.length === 0) return { gained: 0 };
  const known = new Set((await db.petGame.findMany({ where: { userId }, select: { matchId: true } })).map((g) => g.matchId));

  let gained = 0, treats = 0, xp = 0, coins = 0, socialCount = pet.socialDay === today() ? pet.socialCount : 0;
  let connected: Set<string> | null = null;
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
    if (gained === 0) return { gained: 0, error: e instanceof Error ? e.message : "riot" };
  }
  if (gained > 0) {
    await db.pet.update({
      where: { userId },
      data: { treats: { increment: treats }, xp: { increment: xp }, coins: { increment: coins }, socialDay: today(), socialCount },
    });
  }
  return { gained };
}
