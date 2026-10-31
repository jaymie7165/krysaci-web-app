import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkBotKey } from "@/lib/botAuth";
import { allow } from "@/lib/rateLimit";
import { pragueToDate } from "@/lib/time";

export const dynamic = "force-dynamic";

const schema = z.object({
  discordId: z.string().min(1),
  type: z.enum(["lfg", "custom", "tournament"]),
  game: z.string().min(1).max(60), // slug nebo (část) názvu hry
  title: z.string().min(3).max(80),
  description: z.string().max(1000).optional(),
  slots: z.coerce.number().int().min(1).max(256).optional(),
  startsAt: z.string().optional(), // "YYYY-MM-DDTHH:mm" v pražském čase
  rankHint: z.string().max(30).optional(),
  teamSize: z.coerce.number().int().min(1).max(10).optional(),
  prize: z.string().max(100).optional(),
});

/**
 * POST /api/bot/create   (x-bot-key)
 * Založí LFG / customku / turnaj z Discordu (slash příkaz). Turnaje smí zakládat jen admin.
 * Hráč musí mít na webu účet. Nová věc se pak sama oznámí v kanálu přes /api/bot/feed.
 * Odpověď: { ok: true, id, url } nebo { ok: false, reason: "nouser"|"nogame"|"forbidden"|"badtime"|"ratelimit"|"invalid" }.
 */
export async function POST(req: Request) {
  const denied = checkBotKey(req);
  if (denied) return denied;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, reason: "invalid" });
  const d = p.data;
  const no = (reason: string) => NextResponse.json({ ok: false, reason });

  const u = await db.user.findUnique({ where: { discordId: d.discordId } });
  if (!u || u.bannedAt) return no("nouser");
  if (!allow(`botcreate:${u.id}`, 6, 600000)) return no("ratelimit");
  const q = d.game.trim();
  const game = (await db.game.findFirst({ where: { slug: q } })) ?? (await db.game.findFirst({ where: { name: { contains: q, mode: "insensitive" } } }));
  if (!game) return no("nogame");
  const base = (process.env.NEXTAUTH_URL || process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

  if (d.type === "lfg") {
    const post = await db.lfgPost.create({ data: { authorId: u.id, gameId: game.id, title: d.title, description: d.description || null, slots: Math.min(20, d.slots ?? 5), rankHint: d.rankHint || null } });
    return NextResponse.json({ ok: true, id: post.id, url: `${base}/lfg` });
  }
  const startsAt = d.startsAt ? pragueToDate(d.startsAt) : new Date(NaN);
  if (isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now() - 60000) return no("badtime");
  if (d.type === "custom") {
    const c = await db.custom.create({ data: { gameId: game.id, hostId: u.id, title: d.title, description: d.description || null, startsAt, maxPlayers: Math.max(2, Math.min(100, d.slots ?? 10)) } });
    await db.customEntry.create({ data: { customId: c.id, userId: u.id } });
    return NextResponse.json({ ok: true, id: c.id, url: `${base}/customs` });
  }
  if (u.role !== "ADMIN") return no("forbidden");
  const t = await db.tournament.create({
    data: { gameId: game.id, organizerId: u.id, name: d.title, description: d.description || d.title, startsAt, maxPlayers: Math.max(2, d.slots ?? 16), teamSize: d.teamSize ?? 1, prize: d.prize || null },
  });
  return NextResponse.json({ ok: true, id: t.id, url: `${base}/tournaments/${t.id}` });
}
