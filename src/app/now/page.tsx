import Link from "next/link";
import { db } from "@/lib/db";
import { getT, pick } from "@/lib/i18n";
import { getLiveNow } from "@/lib/presence";
import { getTwitchLive } from "@/lib/twitch";
import { getKickLive } from "@/lib/kick";

export const metadata = { title: "Co se děje teď" };

export default async function NowPage() {
  const { locale } = await getT();
  const L = (cs: string, sk: string, en: string) => pick(locale, cs, sk, en);
  const tag = locale === "cs" ? "cs-CZ" : locale === "sk" ? "sk-SK" : "en-GB";
  const time = (d: Date) => d.toLocaleString(tag, { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 3600 * 1000);
  const [live, liveMatches, soonMatches, tournaments, customs, lfg] = await Promise.all([
    getLiveNow().catch(() => []),
    db.esportsMatch.findMany({ where: { status: "live" }, orderBy: { startsAt: "asc" }, take: 10 }),
    db.esportsMatch.findMany({ where: { status: "upcoming", startsAt: { gte: now, lte: soon } }, orderBy: { startsAt: "asc" }, take: 10 }),
    db.tournament.findMany({ where: { status: { in: ["UPCOMING", "LIVE"] }, startsAt: { lte: soon } }, orderBy: { startsAt: "asc" }, take: 6, include: { game: true } }),
    db.custom.findMany({ where: { status: { in: ["UPCOMING", "LIVE"] }, startsAt: { lte: soon } }, orderBy: { startsAt: "asc" }, take: 6, include: { game: true } }),
    db.lfgPost.findMany({ where: { open: true }, orderBy: { createdAt: "desc" }, take: 6, include: { game: true, author: true } }),
  ]);
  const streamers = await db.user.findMany({ where: { OR: [{ twitchLogin: { not: null } }, { kickLogin: { not: null } }] }, select: { handle: true, username: true, twitchLogin: true, kickLogin: true }, take: 60 });
  const streams = (
    await Promise.all(
      streamers.flatMap((s) => [
        getTwitchLive(s.twitchLogin).then((t) => ({ s, t, p: "Twitch" })),
        getKickLive(s.kickLogin).then((t) => ({ s, t, p: "Kick" })),
      ])
    )
  ).filter((x) => x.t);
  const byGame = new Map<string, typeof live>();
  for (const e of live) byGame.set(e.game, [...(byGame.get(e.game) ?? []), e]);
  const Box = ({ title, children, empty }: { title: string; children: React.ReactNode[]; empty: string }) => (
    <section className="card space-y-2 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      {children.length ? <ul className="space-y-1.5 text-sm">{children}</ul> : <p className="text-sm text-slate-500">{empty}</p>}
    </section>
  );
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">{L("Co se děje teď", "Čo sa deje teraz", "What's happening now")}</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Box title={L("Hráči ve hře", "Hráči v hre", "Players in game")} empty={L("Nikdo zrovna nehraje.", "Nikto práve nehrá.", "Nobody is playing right now.")}>
          {[...byGame.entries()].map(([g, list]) => (
            <li key={g}>
              <span className="font-medium">{g}</span> <span className="text-slate-500">({list.length})</span>
              <div className="text-slate-300">
                {list.map((e, i) => (<span key={e.userId}>{i > 0 && ", "}<Link href={`/players/${e.handle}`} className="hover:text-violet-300">{e.username}</Link></span>))}
              </div>
            </li>
          ))}
        </Box>
        {streams.length > 0 && (
          <Box title={L("Streamy živě", "Streamy naživo", "Live streams")} empty="">
            {streams.map(({ s, t, p }) => (
              <li key={s.handle + p}><a href={t!.url} target="_blank" rel="noopener noreferrer" className="hover:text-violet-300"><span className="text-ember">●</span> {s.username} · {p}{t!.game ? ` · ${t!.game}` : ""} <span className="text-slate-500">· {t!.viewers}</span></a></li>
            ))}
          </Box>
        )}
        <Box title={L("Esport živě", "Esport naživo", "Esports live")} empty={L("Žádný zápas zrovna neběží.", "Žiadny zápas práve nebeží.", "No match is live.")}>
          {liveMatches.map((m) => (
            <li key={m.id}><Link href="/esports" className="hover:text-violet-300"><span className="text-ember">●</span> {m.teamA} {m.scoreA ?? 0}:{m.scoreB ?? 0} {m.teamB} <span className="text-slate-500">· {m.league}</span></Link></li>
          ))}
        </Box>
        <Box title={L("Esport v příštích 24 h", "Esport v nasledujúcich 24 h", "Esports next 24 h")} empty={L("Nic nenaplánováno.", "Nič naplánované.", "Nothing scheduled.")}>
          {soonMatches.map((m) => (
            <li key={m.id}><Link href="/pickems" className="hover:text-violet-300">{time(m.startsAt)} · {m.teamA} vs {m.teamB} <span className="text-slate-500">· {m.league}</span></Link></li>
          ))}
        </Box>
        <Box title={L("Turnaje a customky do 24 h", "Turnaje a customky do 24 h", "Tournaments & customs within 24 h")} empty={L("Nic nezačíná.", "Nič nezačína.", "Nothing starting.")}>
          {[
            ...tournaments.map((x) => ({ k: "t" + x.id, at: x.startsAt, label: `🏆 ${x.name} · ${x.game.name}`, href: "/tournaments" })),
            ...customs.map((x) => ({ k: "c" + x.id, at: x.startsAt, label: `🎮 ${x.title} · ${x.game.name}`, href: "/customs" })),
          ].sort((a, b) => a.at.getTime() - b.at.getTime()).map((x) => (
            <li key={x.k}><Link href={x.href} className="hover:text-violet-300">{time(x.at)} · {x.label}</Link></li>
          ))}
        </Box>
        <Box title={L("Hledají spoluhráče", "Hľadajú spoluhráčov", "Looking for players")} empty={L("Žádné otevřené LFG.", "Žiadne otvorené LFG.", "No open LFG.")}>
          {lfg.map((l) => (
            <li key={l.id}><Link href="/lfg" className="hover:text-violet-300">{l.game.name} · {l.title} <span className="text-slate-500">· {l.author.username}</span></Link></li>
          ))}
        </Box>
      </div>
    </div>
  );
}
