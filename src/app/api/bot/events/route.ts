import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkBotKey } from "@/lib/botAuth";

/** GET /api/bot/events  – nadcházející turnaje a customky, aby je bot mohl oznamovat na Discordu. */
export async function GET(req: Request) {
  const denied = checkBotKey(req);
  if (denied) return denied;

  const now = new Date();
  const [tournaments, customs] = await Promise.all([
    db.tournament.findMany({
      where: { status: "UPCOMING", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 20,
      include: { game: true, _count: { select: { entries: true } } },
    }),
    db.custom.findMany({
      where: { status: "UPCOMING", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 20,
      include: { game: true, _count: { select: { entries: true } } },
    }),
  ]);

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return NextResponse.json({
    tournaments: tournaments.map((t) => ({
      id: t.id, name: t.name, game: t.game.name, startsAt: t.startsAt,
      entries: t._count.entries, maxPlayers: t.maxPlayers, url: `${site}/tournaments`,
    })),
    customs: customs.map((c) => ({
      id: c.id, title: c.title, game: c.game.name, startsAt: c.startsAt,
      entries: c._count.entries, maxPlayers: c.maxPlayers, url: `${site}/customs`,
    })),
  });
}
