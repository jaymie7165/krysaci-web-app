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

  const soon = new Date(Date.now() + 10 * 60 * 1000);
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

  // Připomínka 10 minut před začátkem turnaje a customky (přihlášeným a pořadateli).
  const [tours, customs] = await Promise.all([
    db.tournament.findMany({ where: { status: "UPCOMING", startsAt: { gt: new Date(), lte: soon } }, include: { entries: { select: { userId: true } } } }),
    db.custom.findMany({ where: { status: "UPCOMING", startsAt: { gt: new Date(), lte: soon } }, include: { entries: { select: { userId: true } } } }),
  ]);
  for (const t of tours) {
    await notify([t.organizerId, ...t.entries.map((e) => e.userId)], { kind: "tournament", title: `Turnaj ${t.name} začíná za chvíli (do 10 minut)`, url: `/tournaments/${t.id}`, dedupeKey: `tstart:${t.id}` });
  }
  for (const c of customs) {
    await notify([c.hostId, ...c.entries.map((e) => e.userId)], { kind: "custom", title: `Customka ${c.title} začíná za chvíli (do 10 minut)`, url: "/customs", dedupeKey: `cstart:${c.id}` });
  }

  // Pet má hlad: po 14 hodinách bez pamlsku (a než usne), jednou za každé nakrmení.
  const hungry = await db.pet.findMany({
    where: { lastFedAt: { lt: new Date(Date.now() - 14 * 3600 * 1000), gt: new Date(Date.now() - 48 * 3600 * 1000) } },
    select: { userId: true, name: true, lastFedAt: true, treats: true },
    take: 500,
  });
  for (const p of hungry) {
    await notify(p.userId, {
      kind: "pet",
      title: `${p.name} má hlad${p.treats > 0 ? ", nakrm ho" : ", odehraj hru pro pamlsky"}`,
      url: "/pet",
      dedupeKey: `pethungry:${p.lastFedAt.getTime()}`,
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
