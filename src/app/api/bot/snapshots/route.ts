import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkBotKey } from "@/lib/botAuth";
import { DEFAULT_PLATFORM, PLATFORMS, RiotError, recordSnapshots } from "@/lib/riot";

/**
 * POST /api/bot/snapshots   (hlavička: x-bot-key)
 * Uloží aktuální rank všech ověřených propojených Riot účtů do historie (pro graf vývoje).
 * Doporučení: volat z bota jednou za 6 až 12 hodin. Najednou zpracuje nejvýš 40 účtů, nejstarší záznamy jako první.
 */
export async function POST(req: Request) {
  const denied = checkBotKey(req);
  if (denied) return denied;
  const key = process.env.RIOT_API_KEY;
  if (!key) return NextResponse.json({ error: "RIOT_API_KEY není nastaven" }, { status: 503 });

  const accounts = await db.linkedAccount.findMany({
    where: { provider: "riot", verified: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  // Nejdřív ti, kterým se rank dlouho neukládal.
  const last = await db.rankSnapshot.groupBy({ by: ["puuid"], _max: { takenAt: true } }).catch(() => []);
  const lastBy = new Map<string, number>(last.map((l: { puuid: string; _max: { takenAt: Date | null } }): [string, number] => [l.puuid, l._max.takenAt?.getTime() ?? 0]));
  accounts.sort((a: { externalId: string }, b: { externalId: string }) => (lastBy.get(a.externalId) ?? 0) - (lastBy.get(b.externalId) ?? 0));

  let saved = 0;
  const failed: string[] = [];
  for (const a of accounts.slice(0, 40)) {
    const platform = a.region && a.region in PLATFORMS ? a.region : DEFAULT_PLATFORM;
    try {
      const res = await fetch(`https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${a.externalId}`, {
        headers: { "X-Riot-Token": key },
        cache: "no-store",
      });
      if (res.status === 429) throw new RiotError("limit", 429);
      if (!res.ok) throw new RiotError("chyba", res.status);
      const entries: { queueType: string; tier: string; rank: string; leaguePoints: number; wins: number; losses: number }[] =
        await res.json();
      const pick = (q: string) => {
        const e = entries.find((x) => x.queueType === q);
        return e ? { tier: e.tier, division: e.rank, lp: e.leaguePoints, wins: e.wins, losses: e.losses } : null;
      };
      await recordSnapshots(a.externalId, pick("RANKED_SOLO_5x5"), pick("RANKED_FLEX_SR"));
      saved++;
    } catch (e) {
      failed.push(a.displayName);
      if (e instanceof RiotError && e.status === 429) break; // limit Riotu: zbytek příště
    }
  }
  return NextResponse.json({ saved, failed });
}
