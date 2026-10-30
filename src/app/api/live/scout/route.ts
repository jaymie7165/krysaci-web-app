import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import {
  PLATFORMS, ddragon, getLolProfile, getRiotIdByPuuid, getScoutAll, getSoloRank, buildFromMatches, peekLolProfile,
} from "@/lib/riot";
import { advice, comp } from "@/lib/scoutAdvice";
import type { ScoutPlayerOut, ScoutResponse } from "@/lib/scoutTypes";

const schema = z.object({
  platform: z.string().refine((p) => p in PLATFORMS),
  mePuuid: z.string().min(10).max(100).optional(),
  myChampionId: z.number().int().min(0).max(9999).optional(),
  players: z
    .array(
      z.object({
        puuid: z.string().min(10).max(100).nullish(),
        championId: z.number().int().min(0).max(9999),
        team: z.enum(["mine", "enemy"]),
        position: z.string().max(20).optional(),
        name: z.string().max(60).nullish(),
      })
    )
    .max(10),
});

// Jednoduchá ochrana: jeden přihlášený hráč nejvýš jednou za 1,5 s.
const last = new Map<string, number>();

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "login" }, { status: 401 });
  const now = Date.now();
  if (now - (last.get(session.user.id) ?? 0) < 1500) return NextResponse.json({ error: "slow" }, { status: 429 });
  last.set(session.user.id, now);
  if (last.size > 5000) last.clear();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad" }, { status: 400 });
  const { platform, players, mePuuid, myChampionId } = parsed.data;
  const locale = await getLocale();

  const dd = await ddragon();
  const puuids = [...new Set(players.map((p) => p.puuid).filter((x): x is string => !!x))];
  const [scouts, ranks, names] = await Promise.all([
    getScoutAll(puuids, platform).catch(() => new Map()),
    Promise.all(puuids.map((id) => getSoloRank(id, platform).catch(() => null))),
    Promise.all(puuids.map((id) => getRiotIdByPuuid(id, platform).catch(() => null))),
  ]);
  const rankOf = new Map(puuids.map((id, i) => [id, ranks[i]] as const));
  const nameOf = new Map(puuids.map((id, i) => [id, names[i]] as const));

  const out: ScoutPlayerOut[] = players.map((p) => {
    const c = dd.champs[String(p.championId)];
    const s = p.puuid ? scouts.get(p.puuid) : undefined;
    return {
      puuid: p.puuid ?? null,
      team: p.team,
      championId: p.championId,
      champion: c?.id ?? "",
      championName: c?.name ?? "",
      position: p.position ?? "",
      name: p.puuid ? nameOf.get(p.puuid) ?? p.name ?? null : null,
      me: !!mePuuid && p.puuid === mePuuid,
      rank: p.puuid ? rankOf.get(p.puuid) ?? null : null,
      recent: s?.recent ?? [],
      top: s?.top ?? [],
      failed: !!p.puuid && !s,
    };
  });

  const tips = advice(comp(players.filter((p) => p.team === "mine"), dd), comp(players.filter((p) => p.team === "enemy"), dd), locale);

  // Tvůj build ukazujeme jen u tvého ověřeného Riot účtu, ať si nikdo nenačítá cizí historii přes aplikaci.
  let build: ScoutResponse["build"] = null;
  const champ = myChampionId ? dd.champs[String(myChampionId)] : undefined;
  if (mePuuid && champ) {
    const linked = await db.linkedAccount
      .findFirst({ where: { userId: session.user.id, provider: "riot", externalId: mePuuid, verified: true } })
      .catch(() => null);
    if (linked?.gameName && linked.tagLine) {
      const profile =
        (await peekLolProfile(mePuuid, platform)) ??
        (await getLolProfile(mePuuid, linked.gameName, linked.tagLine, platform).catch(() => null));
      const b = profile ? buildFromMatches(profile.matches, champ.id) : null;
      if (b) build = { champion: champ.id, championName: champ.name, ...b };
    }
  }

  const res: ScoutResponse = { version: dd.version, players: out, advice: tips, build, runes: dd.runes };
  return NextResponse.json(res);
}
