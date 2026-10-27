import Link from "next/link";
import { db } from "@/lib/db";
import { auth, signIn } from "@/lib/auth";
import { getT, pick, type Locale } from "@/lib/i18n";
import { PLATFORMS } from "@/lib/riot";
import LolSearch from "@/components/LolSearch";

const tag = (l: Locale) => (l === "cs" ? "cs-CZ" : l === "sk" ? "sk-SK" : "en-GB");

function pragueHour() {
  return (
    Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Prague" }).format(new Date())) %
    24
  );
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
  const user = session?.user;
  const now = new Date();

  const [tournaments, customs, lfg, accounts] = await Promise.all([
    db.tournament.findMany({
      where: { status: "UPCOMING", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 4,
      include: { game: true, _count: { select: { entries: true } } },
    }),
    db.custom.findMany({
      where: { status: "UPCOMING", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 4,
      include: { game: true, _count: { select: { entries: true } } },
    }),
    db.lfgPost.findMany({
      where: { open: true },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { game: true, author: true, _count: { select: { joins: true } } },
    }),
    user ? db.linkedAccount.findMany({ where: { userId: user.id } }) : Promise.resolve([]),
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
    .slice(0, 4);

  const hour = pragueHour();
  const greeting =
    hour >= 5 && hour < 11 ? t("greet_morning")
    : hour >= 11 && hour < 17 ? t("greet_day")
    : hour >= 17 && hour < 22 ? t("greet_evening")
    : t("greet_night");
  const firstName = user?.name?.split(/\s+/)[0];

  const steam = accounts.find((a) => a.provider === "steam");
  const riot = accounts.find((a) => a.provider === "riot");

  return (
    <div className="space-y-12">
      {/* 1. Hledání a pozdrav */}
      <section className="space-y-5">
        <h1 className="text-4xl font-extrabold leading-tight md:text-6xl">
          {user ? `${greeting}, ${firstName}.` : t("hub_guest_title")}
        </h1>
        <p className="max-w-xl text-lg text-slate-300">
          {user
            ? pick(locale, "Najdi hráče v LoL, nebo se podívej, co se dnes chystá.", "Nájdi hráča v LoL, alebo sa pozri, čo sa dnes chystá.", "Look up an LoL player, or see what's coming up today.")
            : t("hub_guest_text")}
        </p>
        <LolSearch locale={locale} />
        {!user && (
          <form
            action={async () => {
              "use server";
              await signIn("discord", { redirectTo: "/" });
            }}
          >
            <button className="btn-ghost">{t("login")}</button>
          </form>
        )}
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* 2. Co se chystá */}
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
                    <Link href={e.href} className="flex items-center gap-4 py-3.5 transition hover:bg-ink-800/60">
                      <div className="w-16 shrink-0 text-center">
                        <p className="text-xs text-slate-400">{s.day} {s.date}</p>
                        <p className="font-display text-xl font-bold text-accent-soft">{s.time}</p>
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

          <div className="mb-3 mt-10 flex items-end justify-between">
            <h2 className="text-2xl font-bold">{t("lfg")}</h2>
            <Link href="/lfg" className="text-sm text-accent-soft hover:text-white">{t("viewAll")}</Link>
          </div>
          {lfg.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-ink-600 p-6 text-slate-400">{t("noData")}</p>
          ) : (
            <ul className="divide-y divide-ink-600/60 border-y border-ink-600/60">
              {lfg.map((p) => (
                <li key={p.id}>
                  <Link href="/lfg" className="flex items-center gap-4 py-3.5 transition hover:bg-ink-800/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-lg font-semibold text-bone">{p.title}</p>
                      <p className="truncate text-sm text-slate-400">{p.game.name}, {p.author.username}</p>
                    </div>
                    <span className="badge shrink-0 text-pulse">{p._count.joins + 1}/{p.slots}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 3. Můj profil / propojení účtů */}
        <aside>
          {user ? (
            <section className="card space-y-5 p-5">
              <div className="flex items-center gap-3">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt="" className="h-12 w-12 rounded-full" />
                ) : (
                  <span className="h-12 w-12 rounded-full bg-ink-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold text-bone">{user.name}</p>
                  <Link href={`/players/${user.handle}`} className="text-sm text-accent-soft hover:text-white">
                    {t("nav_profile")}
                  </Link>
                </div>
              </div>

              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between gap-3 rounded-xl bg-ink-900 px-3 py-2.5">
                  <span className="text-slate-400">Steam</span>
                  <span className="truncate font-medium text-bone">
                    {steam ? steam.displayName : pick(locale, "Nepropojeno", "Neprepojené", "Not linked")}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3 rounded-xl bg-ink-900 px-3 py-2.5">
                  <span className="text-slate-400">LoL, VALORANT</span>
                  <span className="truncate font-medium text-bone">
                    {riot
                      ? `${riot.displayName}${riot.region ? `, ${PLATFORMS[riot.region]?.label ?? riot.region}` : ""}`
                      : pick(locale, "Nepropojeno", "Neprepojené", "Not linked")}
                  </span>
                </li>
              </ul>

              <Link href="/account" className="btn w-full">
                {steam && riot
                  ? pick(locale, "Spravovat účty", "Spravovať účty", "Manage accounts")
                  : pick(locale, "Propojit herní účty", "Prepojiť herné účty", "Link game accounts")}
              </Link>
            </section>
          ) : (
            <section className="card space-y-4 p-6 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-full.png" alt="Play Haven" className="mx-auto w-44" />
              <p className="text-sm leading-relaxed text-slate-300">{t("hub_progress_guest")}</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
