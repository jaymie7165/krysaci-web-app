import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkBotKey } from "@/lib/botAuth";

/**
 * POST /api/bot/presence   (hlavička: x-bot-key)
 * Bot posílá aktuální stav členů serveru, nejlépe jednou za minutu. Každé odeslání nahradí předchozí.
 * Tělo: { "players": [ { "discordId": "123", "game": "VALORANT" }, { "discordId": "456", "game": null } ] }
 */
const schema = z.object({
  players: z
    .array(z.object({ discordId: z.string().min(1).max(32), game: z.string().max(80).nullable() }))
    .max(5000),
});

export async function POST(req: Request) {
  const denied = checkBotKey(req);
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Ukládáme jen ty, kdo právě něco hrají (šetří místo a nic zbytečného neuchováváme).
  const playing = parsed.data.players.filter((p) => p.game);
  const data = { updatedAt: Date.now(), players: playing };
  await db.statCache.upsert({
    where: { key: "presence:discord" },
    update: { data, fetchedAt: new Date() },
    create: { key: "presence:discord", data },
  });
  return NextResponse.json({ stored: playing.length });
}
