import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Stažení všech dat přihlášeného hráče (GDPR, právo na přenositelnost). */
export async function GET() {
  const s = await auth();
  if (!s?.user?.id) return new Response("Unauthorized", { status: 401 });
  const id = s.user.id;
  const [user, gameProfiles, stats, friendships, lfgPosts, lfgJoins, entries, customs, customEntries, tickets, suggestions, votes, linked, picks] =
    await Promise.all([
      db.user.findUnique({ where: { id } }),
      db.gameProfile.findMany({ where: { userId: id } }),
      db.playerStat.findMany({ where: { userId: id } }),
      db.friendship.findMany({ where: { OR: [{ requesterId: id }, { addresseeId: id }] } }),
      db.lfgPost.findMany({ where: { authorId: id } }).catch(() => []),
      db.lfgJoin.findMany({ where: { userId: id } }),
      db.tournamentEntry.findMany({ where: { userId: id } }),
      db.custom.findMany({ where: { hostId: id } }),
      db.customEntry.findMany({ where: { userId: id } }),
      db.ticket.findMany({ where: { authorId: id }, include: { messages: true } }).catch(() => []),
      db.gameSuggestion.findMany({ where: { proposerId: id } }),
      db.gameVote.findMany({ where: { userId: id } }),
      db.linkedAccount.findMany({ where: { userId: id } }),
      db.pick.findMany({ where: { userId: id } }),
    ]);
  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), user, gameProfiles, stats, friendships, lfgPosts, lfgJoins, entries, customs, customEntries, tickets, suggestions, votes, linkedAccounts: linked, picks },
    null,
    2
  );
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="playhaven-data.json"',
      "cache-control": "no-store",
    },
  });
}
