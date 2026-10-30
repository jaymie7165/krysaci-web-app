import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Kalendář (.ics) turnajů a customek. ?mine=1 = jen ty, do kterých jsem přihlášený. */
export async function GET(req: Request) {
  const mine = new URL(req.url).searchParams.get("mine") === "1";
  const s = mine ? await auth() : null;
  if (mine && !s?.user?.id) return new Response("Unauthorized", { status: 401 });
  const from = new Date(Date.now() - 24 * 3600 * 1000);
  const uid = s?.user?.id;
  const [ts, cs] = await Promise.all([
    db.tournament.findMany({
      where: { startsAt: { gte: from }, status: { not: "CANCELLED" }, ...(uid ? { entries: { some: { userId: uid } } } : {}) },
      include: { game: true }, orderBy: { startsAt: "asc" }, take: 100,
    }),
    db.custom.findMany({
      where: { startsAt: { gte: from }, status: { not: "CANCELLED" }, ...(uid ? { entries: { some: { userId: uid } } } : {}) },
      include: { game: true }, orderBy: { startsAt: "asc" }, take: 100,
    }),
  ]);
  const events = [
    ...ts.map((x) => ({ uid: `t-${x.id}`, at: x.startsAt, title: `🏆 ${x.name} (${x.game.name})`, desc: x.description, hours: 3 })),
    ...cs.map((x) => ({ uid: `c-${x.id}`, at: x.startsAt, title: `🎮 ${x.title} (${x.game.name})`, desc: x.description ?? "", hours: 2 })),
  ];
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Play Haven//CS", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Play Haven"];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@playhaven`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(e.at)}`,
      `DTEND:${fmt(new Date(e.at.getTime() + e.hours * 3600 * 1000))}`,
      `SUMMARY:${esc(e.title)}`,
      `DESCRIPTION:${esc(e.desc)}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'inline; filename="playhaven.ics"', "cache-control": "no-store" },
  });
}
