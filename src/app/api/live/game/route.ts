import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { PLATFORMS, getLiveGame } from "@/lib/riot";

const schema = z.object({
  platform: z.string().refine((p) => p in PLATFORMS),
  puuid: z.string().min(10).max(100),
});
const last = new Map<string, number>();

/** Je hráč právě ve hře? Vrací hráče obou týmů (puuid, šampion), které aplikace pošle do scoutingu. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "login" }, { status: 401 });
  const now = Date.now();
  if (now - (last.get(session.user.id) ?? 0) < 4000) return NextResponse.json({ error: "slow" }, { status: 429 });
  last.set(session.user.id, now);
  if (last.size > 5000) last.clear();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad" }, { status: 400 });
  try {
    const game = await getLiveGame(parsed.data.puuid, parsed.data.platform);
    return NextResponse.json({
      game: game && {
        queue: game.queue,
        startedAt: game.startedAt,
        players: game.players.map((p) => ({ puuid: p.puuid, teamId: p.teamId, championId: p.championId })),
      },
    });
  } catch {
    return NextResponse.json({ error: "riot" }, { status: 502 });
  }
}
