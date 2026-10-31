import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkBotKey } from "@/lib/botAuth";

export const dynamic = "force-dynamic";

const site = () => (process.env.NEXTAUTH_URL || process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

/**
 * GET /api/bot/feed   (x-bot-key)
 * Nové věci z webu, které bot ještě neoznámil na Discordu (jen z posledních 24 h):
 * { items: [{ type: "tournament"|"custom"|"lfg"|"news", id, title, description, game, by, startsAt, slots, taken, prize, url }] }
 * Po odeslání je bot potvrdí přes POST (níže).
 */
export async function GET(req: Request) {
  const denied = checkBotKey(req);
  if (denied) return denied;
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const base = site();
  const [tournaments, customs, lfg, news] = await Promise.all([
    db.tournament.findMany({ where: { announcedAt: null, createdAt: { gt: since }, status: "UPCOMING" }, include: { game: true, organizer: { select: { username: true } }, _count: { select: { entries: true } } }, take: 10 }),
    db.custom.findMany({ where: { announcedAt: null, createdAt: { gt: since }, status: "UPCOMING" }, include: { game: true, host: { select: { username: true } }, _count: { select: { entries: true } } }, take: 10 }),
    db.lfgPost.findMany({ where: { announcedAt: null, createdAt: { gt: since }, open: true }, include: { game: true, author: { select: { username: true } }, _count: { select: { joins: true } } }, take: 10 }),
    db.news.findMany({ where: { announcedAt: null, createdAt: { gt: since } }, take: 5 }),
  ]);
  return NextResponse.json({
    items: [
      ...tournaments.map((t) => ({ type: "tournament", id: t.id, title: t.name, description: t.description, game: t.game.name, by: t.organizer.username, startsAt: t.startsAt, slots: t.maxPlayers, taken: t._count.entries, prize: t.prize, teamSize: t.teamSize, url: `${base}/tournaments/${t.id}` })),
      ...customs.map((c) => ({ type: "custom", id: c.id, title: c.title, description: c.description, game: c.game.name, by: c.host.username, startsAt: c.startsAt, slots: c.maxPlayers, taken: c._count.entries, url: `${base}/customs` })),
      ...lfg.map((l) => ({ type: "lfg", id: l.id, title: l.title, description: l.description, game: l.game.name, by: l.author.username, slots: l.slots, taken: l._count.joins + 1, rankHint: l.rankHint, url: `${base}/lfg` })),
      ...news.map((n) => ({ type: "news", id: n.id, title: n.title, description: n.body.slice(0, 400), url: `${base}/news` })),
    ],
  });
}

/** POST /api/bot/feed  { items: [{ type, id }] } – bot potvrdí, že to oznámil. */
export async function POST(req: Request) {
  const denied = checkBotKey(req);
  if (denied) return denied;
  const p = z.object({ items: z.array(z.object({ type: z.enum(["tournament", "custom", "lfg", "news"]), id: z.string() })).max(100) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Špatné tělo" }, { status: 400 });
  const now = new Date();
  for (const it of p.data.items) {
    const where = { id: it.id }, data = { announcedAt: now };
    if (it.type === "tournament") await db.tournament.updateMany({ where, data });
    else if (it.type === "custom") await db.custom.updateMany({ where, data });
    else if (it.type === "lfg") await db.lfgPost.updateMany({ where, data });
    else await db.news.updateMany({ where, data });
  }
  return NextResponse.json({ ok: true });
}
