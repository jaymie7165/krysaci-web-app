import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkBotKey } from "@/lib/botAuth";
import { playKey } from "@/lib/fivem";

/**
 * POST /api/bot/presence   (hlavička: x-bot-key)
 * Bot posílá aktuální stav členů serveru, nejlépe jednou za minutu. Každé odeslání nahradí předchozí.
 * Tělo: { "players": [ { "discordId": "123", "game": "VALORANT" }, { "discordId": "456", "game": null } ] }
 */
const schema = z.object({
  players: z
    .array(z.object({
      discordId: z.string().min(1).max(32),
      game: z.string().max(80).nullable(),
      details: z.string().max(120).nullish(), // např. "Competitive" nebo název FiveM serveru
      state: z.string().max(120).nullish(),
      startedAt: z.number().int().nullish(), // kdy hra podle Discordu začala (ms)
    }))
    .max(5000),
});

export async function POST(req: Request) {
  const denied = checkBotKey(req);
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Ukládáme jen ty, kdo právě něco hrají (šetří místo a nic zbytečného neuchováváme).
  const playing = parsed.data.players.filter((p) => p.game);
  const nowMs = Date.now();

  // Celkový čas ve hře: ke každému, kdo hrál to samé už minule, se přičte uplynulý čas (max. 3 minuty na jedno odeslání).
  // FiveM se počítá zvlášť pro každý server (SkyRP, Pohodáři...).
  const prevRow = await db.statCache.findUnique({ where: { key: "presence:discord" } }).catch(() => null);
  const prev = prevRow?.data as { updatedAt?: number; players?: { discordId: string; game: string | null; details?: string | null; state?: string | null }[] } | undefined;
  if (prev?.updatedAt && prev.players) {
    const delta = Math.min(180, Math.max(0, Math.round((nowMs - prev.updatedAt) / 1000)));
    const before = new Map(prev.players.filter((p) => p.game).map((p) => [p.discordId, playKey(p.game!, p.details, p.state).key]));
    const still = playing
      .map((p) => ({ p, k: playKey(p.game!, p.details, p.state) }))
      .filter(({ p, k }) => before.get(p.discordId) === k.key);
    if (delta > 0 && still.length) {
      const users = await db.user.findMany({ where: { discordId: { in: still.map(({ p }) => p.discordId) }, showActivity: true }, select: { id: true, discordId: true } });
      const byId = new Map(users.map((u) => [u.discordId, u.id]));
      for (const { p, k } of still) {
        const uid = byId.get(p.discordId);
        if (!uid) continue;
        await db.playTime
          .upsert({ where: { userId_gameKey: { userId: uid, gameKey: k.key } }, update: { seconds: { increment: delta }, gameName: k.name }, create: { userId: uid, gameKey: k.key, gameName: k.name, seconds: delta } })
          .catch(() => null);
      }
    }
  }
  const data = { updatedAt: nowMs, players: playing };
  await db.statCache.upsert({
    where: { key: "presence:discord" },
    update: { data, fetchedAt: new Date() },
    create: { key: "presence:discord", data },
  });
  return NextResponse.json({ stored: playing.length });
}
