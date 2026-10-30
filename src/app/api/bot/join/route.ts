import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkBotKey } from "@/lib/botAuth";
import { notify } from "@/lib/notify";

/**
 * POST /api/bot/join   (x-bot-key)
 * Tělo: { "discordId": "123", "type": "custom" | "lfg" | "tournament", "id": "<id z webu>" }
 * Hráč se přidá přímo z Discordu (tlačítko u zprávy). Musí mít na webu účet (aspoň jednou přihlášen).
 * Odpověď: { ok: true } nebo { ok: false, reason: "notfound" | "nouser" | "closed" | "full" }.
 */
const schema = z.object({ discordId: z.string().min(1), type: z.enum(["custom", "lfg", "tournament"]), id: z.string().min(1) });

export async function POST(req: Request) {
  const denied = checkBotKey(req);
  if (denied) return denied;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Špatné tělo" }, { status: 400 });
  const { discordId, type, id } = p.data;
  const u = await db.user.findUnique({ where: { discordId } });
  if (!u || u.bannedAt) return NextResponse.json({ ok: false, reason: "nouser" });
  const no = (reason: string) => NextResponse.json({ ok: false, reason });

  if (type === "custom") {
    const c = await db.custom.findUnique({ where: { id }, include: { _count: { select: { entries: true } } } });
    if (!c) return no("notfound");
    if (c.status !== "UPCOMING") return no("closed");
    if (c._count.entries >= c.maxPlayers) return no("full");
    await db.customEntry.upsert({ where: { customId_userId: { customId: id, userId: u.id } }, update: {}, create: { customId: id, userId: u.id } });
    await notify(c.hostId, { kind: "custom", title: `${u.username} se přidal do tvé customky: ${c.title}`, url: "/customs", dedupeKey: `cjoin:${id}:${u.id}` });
  } else if (type === "lfg") {
    const l = await db.lfgPost.findUnique({ where: { id }, include: { _count: { select: { joins: true } } } });
    if (!l) return no("notfound");
    if (!l.open) return no("closed");
    if (l._count.joins + 1 >= l.slots) return no("full");
    await db.lfgJoin.upsert({ where: { postId_userId: { postId: id, userId: u.id } }, update: {}, create: { postId: id, userId: u.id } });
    await notify(l.authorId, { kind: "lfg", title: `${u.username} se přidal do tvého LFG: ${l.title}`, url: "/lfg", dedupeKey: `lfgjoin:${id}:${u.id}` });
  } else {
    const t = await db.tournament.findUnique({ where: { id }, include: { _count: { select: { entries: true } } } });
    if (!t) return no("notfound");
    if (t.status !== "UPCOMING") return no("closed");
    if (t._count.entries >= t.maxPlayers) return no("full");
    await db.tournamentEntry.upsert({ where: { tournamentId_userId: { tournamentId: id, userId: u.id } }, update: {}, create: { tournamentId: id, userId: u.id } });
  }
  return NextResponse.json({ ok: true });
}
