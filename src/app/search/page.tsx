import Link from "next/link";
import { db } from "@/lib/db";
import { getT, pick } from "@/lib/i18n";

export const metadata = { title: "Hledání" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { locale } = await getT();
  const L = (cs: string, sk: string, en: string) => pick(locale, cs, sk, en);
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const has = (f: string) => ({ [f]: { contains: q, mode: "insensitive" as const } });
  const [players, games, tournaments, customs, lfg, news] = q.length < 2 ? [[], [], [], [], [], []] : await Promise.all([
    db.user.findMany({ where: { OR: [has("handle"), has("username")] }, take: 8, orderBy: { lastSeenAt: "desc" } }),
    db.game.findMany({ where: has("name"), take: 6 }),
    db.tournament.findMany({ where: { OR: [has("name"), has("description")] }, take: 6, orderBy: { startsAt: "desc" } }),
    db.custom.findMany({ where: has("title"), take: 6, orderBy: { startsAt: "desc" } }),
    db.lfgPost.findMany({ where: { OR: [has("title"), has("description")] }, take: 6, orderBy: { createdAt: "desc" } }),
    db.news.findMany({ where: { OR: [has("title"), has("body")] }, take: 5, orderBy: { createdAt: "desc" } }),
  ]);
  const total = players.length + games.length + tournaments.length + customs.length + lfg.length + news.length;
  const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="card space-y-2 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      <ul className="space-y-1 text-sm">{children}</ul>
    </section>
  );
  const a = "text-slate-200 hover:text-violet-300";
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-3xl font-bold">{L("Hledání", "Hľadanie", "Search")}</h1>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} autoFocus placeholder={L("Hráč, hra, turnaj, customka…", "Hráč, hra, turnaj, customka…", "Player, game, tournament, custom…")} className="input flex-1" />
        <button className="btn">{L("Hledat", "Hľadať", "Search")}</button>
      </form>
      {q.length >= 2 && total === 0 && <p className="text-slate-400">{L("Nic jsem nenašel.", "Nič som nenašiel.", "Nothing found.")}</p>}
      {players.length > 0 && <Group title={L("Hráči", "Hráči", "Players")}>{players.map((p) => <li key={p.id}><Link href={`/players/${p.handle}`} className={a}>{p.username} <span className="text-slate-500">@{p.handle}</span></Link></li>)}</Group>}
      {games.length > 0 && <Group title={L("Hry", "Hry", "Games")}>{games.map((g) => <li key={g.id}><Link href={`/games/${g.slug}`} className={a}>{g.name}</Link></li>)}</Group>}
      {tournaments.length > 0 && <Group title={L("Turnaje", "Turnaje", "Tournaments")}>{tournaments.map((t) => <li key={t.id}><Link href="/tournaments" className={a}>{t.name}</Link></li>)}</Group>}
      {customs.length > 0 && <Group title="Customky">{customs.map((c) => <li key={c.id}><Link href="/customs" className={a}>{c.title}</Link></li>)}</Group>}
      {lfg.length > 0 && <Group title="LFG">{lfg.map((l) => <li key={l.id}><Link href="/lfg" className={a}>{l.title}</Link></li>)}</Group>}
      {news.length > 0 && <Group title={L("Novinky", "Novinky", "News")}>{news.map((n) => <li key={n.id}><Link href="/news" className={a}>{n.title}</Link></li>)}</Group>}
    </div>
  );
}
