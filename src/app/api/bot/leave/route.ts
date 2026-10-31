import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkBotKey } from "@/lib/botAuth";

export const dynamic = "force-dynamic";

/** POST /api/bot/leave  { discordId, type: "custom"|"lfg"|"tournament", id } – hráč se odhlásí z Discordu. */
export async function POST(req: Request) {
  const denied = checkBotKey(req);
  if (denied) return denied;
  const p = z.object({ discordId: z.string().min(1), type: z.enum(["custom", "lfg", "tournament"]), id: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Špatné tělo" }, { status: 400 });
  const u = await db.user.findUnique({ where: { discordId: p.data.discordId } });
  if (!u) return NextResponse.json({ ok: false, reason: "nouser" });
  const { type, id } = p.data;
  if (type === "custom") await db.customEntry.deleteMany({ where: { customId: id, userId: u.id } });
  else if (type === "lfg") await db.lfgJoin.deleteMany({ where: { postId: id, userId: u.id } });
  else {
    const t = await db.tournament.findUnique({ where: { id }, select: { status: true } });
    if (t && t.status === "UPCOMING") await db.tournamentEntry.deleteMany({ where: { tournamentId: id, userId: u.id } });
  }
  return NextResponse.json({ ok: true });
}
