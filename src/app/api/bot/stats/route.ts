import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkBotKey } from "@/lib/botAuth";

/**
 * POST /api/bot/stats   (hlavička: x-bot-key)
 * Tělo: { "stats": [ { "discordId": "123", "username": "Jmeno", "game": "valorant",
 *                      "points": 1200, "wins": 10, "losses": 4 } ] }
 * Pokud hráč na webu ještě není, vytvoří se "stínový" profil, který se propojí po přihlášení přes Discord.
 */
const schema = z.object({
  stats: z
    .array(
      z.object({
        discordId: z.string().min(1),
        username: z.string().min(1).max(64).optional(),
        game: z.string().min(1),
        points: z.number().int(),
        wins: z.number().int().min(0).default(0),
        losses: z.number().int().min(0).default(0),
      })
    )
    .max(500),
});

function handleFrom(name: string, discordId: string) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 16);
  return `${base || "hrac"}${discordId.slice(-4)}`;
}

export async function POST(req: Request) {
  const denied = checkBotKey(req);
  if (denied) return denied;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const games = await db.game.findMany();
  const bySlug = new Map(games.map((g) => [g.slug, g.id]));
  let updated = 0;
  const skipped: string[] = [];

  for (const s of parsed.data.stats) {
    const gameId = bySlug.get(s.game);
    if (!gameId) {
      skipped.push(`neznámá hra: ${s.game}`);
      continue;
    }
    const user = await db.user.upsert({
      where: { discordId: s.discordId },
      update: s.username ? { username: s.username } : {},
      create: {
        discordId: s.discordId,
        username: s.username ?? "Hráč",
        handle: handleFrom(s.username ?? "hrac", s.discordId),
      },
    });
    await db.playerStat.upsert({
      where: { userId_gameId: { userId: user.id, gameId } },
      update: { points: s.points, wins: s.wins, losses: s.losses, matches: s.wins + s.losses },
      create: { userId: user.id, gameId, points: s.points, wins: s.wins, losses: s.losses, matches: s.wins + s.losses },
    });
    updated++;
  }

  return NextResponse.json({ updated, skipped });
}
