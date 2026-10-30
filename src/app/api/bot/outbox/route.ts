import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkBotKey } from "@/lib/botAuth";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * GET /api/bot/outbox   (x-bot-key)
 * Vrátí oznámení, která má bot poslat do Discord DM: { items: [{ id, discordId, title, body, url }] }.
 * Bot je po odeslání potvrdí přes POST (níže). Volat třeba jednou za minutu.
 * Při každém dotazu se také vygenerují připomínky "tvůj tip začíná za chvíli".
 */
export async function GET(req: Request) {
  const denied = checkBotKey(req);
  if (denied) return denied;

  const soon = new Date(Date.now() + 20 * 60 * 1000);
  const matches = await db.esportsMatch.findMany({
    where: { status: "upcoming", startsAt: { gt: new Date(), lte: soon } },
    include: { picks: { select: { userId: true } } },
  });
  for (const m of matches) {
    await notify(m.picks.map((p) => p.userId), {
      kind: "pickem",
      title: `Tvůj tip začíná: ${m.teamA} vs ${m.teamB} (${m.league})`,
      url: "/pickems",
      dedupeKey: `pickstart:${m.id}`,
    });
  }

  const rows = await db.notification.findMany({
    where: { sentAt: null, user: { notifyDiscord: true } },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { user: { select: { discordId: true } } },
  });
  const base = (process.env.NEXTAUTH_URL || process.env.AUTH_URL || "").replace(/\/$/, "");
  return NextResponse.json({
    items: rows.map((r) => ({ id: r.id, discordId: r.user.discordId, kind: r.kind, title: r.title, body: r.body, url: r.url && base ? base + r.url : r.url })),
  });
}

/** POST /api/bot/outbox  { "ids": ["..."] }  – bot potvrdí, že je odeslal. */
export async function POST(req: Request) {
  const denied = checkBotKey(req);
  if (denied) return denied;
  const parsed = z.object({ ids: z.array(z.string()).max(200) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Špatné tělo" }, { status: 400 });
  const r = await db.notification.updateMany({ where: { id: { in: parsed.data.ids }, sentAt: null }, data: { sentAt: new Date() } });
  return NextResponse.json({ ok: true, marked: r.count });
}
