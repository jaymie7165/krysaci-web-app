import Link from "next/link";
import { db } from "@/lib/db";
import { auth, signIn } from "@/lib/auth";
import { getT, type Locale } from "@/lib/i18n";
import GameCard from "@/components/GameCard";

const tag = (l: Locale) => (l === "cs" ? "cs-CZ" : l === "sk" ? "sk-SK" : "en-GB");

function pragueHour() {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Prague" }).format(new Date())
  ) % 24;
}

function slot(locale: Locale, d: Date) {
  const f = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(tag(locale), { ...o, timeZone: "Europe/Prague" }).format(d);
  return {
    day: f({ weekday: "short" }),
    date: f({ day: "numeric", month: "numeric" }),
    time: f({ hour: "2-digit", minute: "2-digit" }),
  };
}

export default async function Home() {
  const { t, locale } = await getT();
  const session = await auth();
  const now = new Date();
  const userId = session?.user?.id;

  const [games, tournaments, customs, lfg, playerCount, lfgCount, myStats, top] = await Promise.all([
    db.game.findMany({ orderBy: { sortOrder: "asc" } }),
    db.tournament.findMany({
      where: { status: "UPCOMING", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 6,
      include: { game: true, _count: { select: { entries: true } } },
    }),
    db.custom.findMany({
      where: { status: "UPCOMING", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 6,
      include: { game: true, _count: { select: { entries: true } } },
    }),
    db.lfgPost.findMany({
      where: { open: true },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { game: true, author: true, _count: { select: { joins: true } } },
    }),
    db.user.count(),
    db.lfgPost.count({ where: { open: true } }),
    userId
      ? db.playerStat.findMany({ where: { userId }, orderBy: { points: "desc" }, take: 3, include: { game: true } })
      : Promise.resolve([]),
    db.playerStat.findMany({ orderBy: { points: "desc" }, take: 5, include: { user: true, game: true } }),
  ]);

  const events = [
    ...tournaments.map((x) => ({
      key: `t-${x.id}`, kind: t("hub_kind_tournament"), title: x.name, game: x.game.name,
      startsAt: x.startsAt, entries: x._count.entries, max: x.maxPlayers, href: "/tournaments",
    })),
    ...customs.map((x) => ({
      key: `c-${x.id}`, kind: t("hub_kind_custom"), title: x.title, game: x.game.name,
      startsAt: x.startsAt, entries: x._count.entries, max: x.maxPlayers, href: "/customs",
    })),
  ]
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, 6);

  const hour = pragueHour();
  const greeting =
    hour >= 5 && hour < 11 ? t("greet_morning")
    : hour >= 11 && hour < 17 ? t("greet_day")
    : hour >= 17 && hour < 22 ? t("greet_evening")
    : t("greet_night");
  const firstName = session?.user?.name?.split(/\s+/)[0];

  return (
    <div className="space-y-14">
      <section className="max-w-3xl">
        <h1 className="text-5xl font-extrabold leading-[1.02] md:text-7xl">
          {session?.user ? `${greeting}, ${firstName}.` : t("hub_guest_title")}
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
          {session?.user ? t("hub_user_text") : t("hub_guest_text")}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          {session?.user ? (
            <>
              <Link href="/lfg" className="btn px-5 py-3 text-base">{t("hub_find_party")}</Link>
              <Link href="/tournaments" className="btn-ghost px-5 py-3 text-base">{t("hub_compete")}</Link>
            </>
          ) : (
            <>
              <form
                action={async () => {
                  "use server";
                  await signIn("discord", { redirectTo: "/" });
                }}
              >
                <button className="btn px-5 py-3 text-base">{t("login")}</button>
              </form>
              <Link href="/games" className="btn-ghost px-5 py-3 text-base">{t("nav_games")}</Link>
            </>
          )}
        </div>
        <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-400">
          {[
            [playerCount, t("players_short")],
            [lfgCount, t("hub_stat_lfg")],
            [tournaments.length + customs.length, t("hub_stat_events")],
          ].map(([n, label]) => (
            <div key={label as string} className="flex items-baseline gap-2">
              <dt className="font-display text-xl font-bold text-bone">{n}</dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-10">
          <section>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="text-2xl font-bold">{t("hub_happening")}</h2>
              <Link href="/tournaments" className="text-sm text-accent-soft hover:text-white">{t("viewAll")}</Link>
            </div>
            {events.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-ink-600 p-6 text-slate-400">{t("noData")}</p>
            ) : (
              <ul className="divide-y divide-ink-600/60 border-y border-ink-600/60">
                {events.map((e) => {
                  const s = slot(locale, e.startsAt);
                  const free = Math.max(0, e.max - e.entries);
                  return (
                    <li key={e.key}>
                      <Link href={e.href} className="flex items-center gap-4 py-4 transition hover:bg-ink-800/60">
                        <div className="w-16 shrink-0 text-center">
                          <p className="text-xs text-slate-400">{s.day} {s.date}</p>
                          <p className="font-display text-xl font-bold text-accent">{s.time}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-lg font-semibold text-bone">{e.title}</p>
                          <p className="truncate text-sm text-slate-400">{e.kind}, {e.game}</p>
                        </div>
                        <span className={`badge shrink-0 ${free === 0 ? "text-ember" : ""}`}>
                          {free === 0 ? t("full") : `${free} ${t("hub_free")}`}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="text-2xl font-bold">{t("lfg")}</h2>
              <Link href="/lfg" className="text-sm text-accent-soft hover:text-white">{t("viewAll")}</Link>
            </div>
            {lfg.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-ink-600 p-6 text-slate-400">{t("noData")}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {lfg.map((p) => (
                  <Link key={p.id} href="/lfg" className="card block p-4 transition hover:shadow-glow">
                    <p className="font-display text-lg font-semibold text-bone">{p.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{p.game.name}, {p.author.username}</p>
                    <p className="mt-3 text-sm text-pulse">
                      {p._count.joins + 1}/{p.slots}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-8">
          <section className="card border-pulse/30 p-5">
            <h2 className="text-xl font-bold">{t("hub_progress")}</h2>
            {!session?.user ? (
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{t("hub_progress_guest")}</p>
            ) : myStats.length === 0 ? (
              <>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{t("hub_progress_empty")}</p>
                <Link href={`/players/${session.user.handle}`} className="btn mt-4">{t("hub_add_profile")}</Link>
              </>
            ) : (
              <ul className="mt-4 space-y-4">
                {myStats.map((s) => {
                  const wr = s.matches > 0 ? Math.round((s.wins / s.matches) * 100) : 0;
                  return (
                    <li key={s.id}>
                      <div className="flex items-baseline justify-between">
                        <span className="font-medium text-bone">{s.game.name}</span>
                        <span className="font-display text-2xl font-bold text-pulse">{s.points}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-600">
                        <div className="h-full rounded-full bg-pulse" style={{ width: `${wr}%` }} />
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400">
                        {s.wins} {t("wins").toLowerCase()}, {s.losses} {t("losses").toLowerCase()}, {t("winrate")} {wr} %
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="text-xl font-bold">{t("hub_top")}</h2>
              <Link href="/leaderboards" className="text-sm text-accent-soft hover:text-white">{t("viewAll")}</Link>
            </div>
            {top.length === 0 ? (
              <p className="text-sm text-slate-400">{t("noData")}</p>
            ) : (
              <ol className="space-y-1">
                {top.map((r, i) => (
                  <li key={r.id}>
                    <Link
                      href={`/players/${r.user.handle}`}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-ink-800"
                    >
                      <span className="w-5 text-center font-display text-lg font-bold text-slate-500">{i + 1}</span>
                      {r.user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.user.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
                      ) : (
                        <span className="h-8 w-8 rounded-full bg-ink-600" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-bone">{r.user.username}</span>
                        <span className="block truncate text-xs text-slate-400">{r.game.name}</span>
                      </span>
                      <span className="font-display font-bold text-accent">{r.points}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-2xl font-bold">{t("games")}</h2>
          <Link href="/games" className="text-sm text-accent-soft hover:text-white">{t("viewAll")}</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {games.map((g) => (
            <GameCard key={g.id} game={g} compact />
          ))}
        </div>
      </section>
    </div>
  );
}
