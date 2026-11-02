import { db } from "@/lib/db";
import { getDuoMatches } from "@/lib/riot";

const GAP_MS = 15 * 60 * 1000; // jak často se smí hráči dotahovat nové hry
const KEEP = 300; // z kolika posledních her se statistika počítá

/**
 * Dotáhne nové hry z ověřených Riot účtů hráče a uloží, kdo z komunity byl ve stejném týmu a kdo proti.
 * Nejvýš jednou za 15 minut, max. 8 nových her na účet (limity Riotu). Volá se na pozadí.
 */
export async function syncDuoGames(userId: string, gapMs = GAP_MS): Promise<void> {
  const key = `duo:sync:${userId}`;
  const last = await db.statCache.findUnique({ where: { key } }).catch(() => null);
  if (last && Date.now() - last.fetchedAt.getTime() < gapMs) return;
  await db.statCache.upsert({ where: { key }, update: { data: {}, fetchedAt: new Date() }, create: { key, data: {} } }).catch(() => null);

  const accounts = await db.linkedAccount.findMany({ where: { userId, provider: "riot", verified: true } });
  if (accounts.length === 0) return;
  const known = new Set((await db.duoGame.findMany({ where: { userId }, select: { matchId: true }, take: 400, orderBy: { playedAt: "desc" } })).map((g) => g.matchId));

  for (const a of accounts) {
    let matches;
    try {
      matches = await getDuoMatches(a.externalId, a.region ?? "eun1", known);
    } catch {
      continue;
    }
    if (matches.length === 0) continue;
    const all = [...new Set(matches.flatMap((m) => [...m.team, ...m.foes]))];
    const owners = await db.linkedAccount.findMany({
      where: { provider: "riot", verified: true, externalId: { in: all }, userId: { not: userId } },
      select: { userId: true, externalId: true },
    });
    const who = new Map(owners.map((o) => [o.externalId, o.userId]));
    for (const m of matches) {
      known.add(m.id);
      const mates = [...new Set(m.team.map((p) => who.get(p)).filter((x): x is string => !!x))];
      const foes = [...new Set(m.foes.map((p) => who.get(p)).filter((x): x is string => !!x))];
      await db.duoGame
        .create({ data: { userId, matchId: m.id, win: m.win, queue: m.queue, playedAt: new Date(m.playedAt), mates: JSON.stringify(mates), foes: JSON.stringify(foes) } })
        .catch(() => null); // duplicita (např. druhý účet ve stejné hře)
    }
  }
}

export type DuoRow = {
  userId: string; handle: string; username: string; avatarUrl: string | null;
  together: number; togetherWins: number; against: number; againstWins: number;
};

const parse = (s: string): string[] => { try { const a = JSON.parse(s); return Array.isArray(a) ? a.filter((x) => typeof x === "string") : []; } catch { return []; } };

/** Spoluhráči z komunity seřazení podle počtu společných her. */
export async function getDuoStats(userId: string): Promise<{ rows: DuoRow[]; games: number }> {
  const games = await db.duoGame.findMany({ where: { userId }, orderBy: { playedAt: "desc" }, take: KEEP, select: { win: true, mates: true, foes: true } });
  const agg = new Map<string, { t: number; tw: number; a: number; aw: number }>();
  const bump = (id: string, f: (r: { t: number; tw: number; a: number; aw: number }) => void) => {
    const r = agg.get(id) ?? { t: 0, tw: 0, a: 0, aw: 0 };
    f(r);
    agg.set(id, r);
  };
  for (const g of games) {
    parse(g.mates).forEach((id) => bump(id, (r) => { r.t++; if (g.win) r.tw++; }));
    parse(g.foes).forEach((id) => bump(id, (r) => { r.a++; if (g.win) r.aw++; }));
  }
  const ids = [...agg.keys()];
  if (ids.length === 0) return { rows: [], games: games.length };
  const users = await db.user.findMany({ where: { id: { in: ids }, bannedAt: null }, select: { id: true, handle: true, username: true, avatarUrl: true } });
  const rows = users
    .map((u) => { const r = agg.get(u.id)!; return { userId: u.id, handle: u.handle, username: u.username, avatarUrl: u.avatarUrl, together: r.t, togetherWins: r.tw, against: r.a, againstWins: r.aw }; })
    .sort((a, b) => b.together + b.against - (a.together + a.against));
  return { rows, games: games.length };
}
