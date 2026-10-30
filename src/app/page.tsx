import Link from "next/link";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { auth, signIn } from "@/lib/auth";
import { getT, pick, type Locale } from "@/lib/i18n";
import { DEFAULT_PLATFORM, PLATFORMS, peekLolProfile } from "@/lib/riot";
import { getLiveNow, normGame, type LiveEntry } from "@/lib/presence";
import GameImage from "@/components/GameImage";
import LolSearch from "@/components/LolSearch";
import RankTag from "@/components/RankTag";
import Onboarding from "@/components/Onboarding";
import NewsList from "@/components/NewsList";

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

function inText(locale: Locale, d: Date) {
  const min = Math.round((d.getTime() - Date.now()) / 60000);
  if (min < 1) return pick(locale, "právě začíná", "práve začína", "starting now");
  if (min < 60) return pick(locale, `za ${min} min`, `o ${min} min`, `in ${min} min`);
  const h = Math.floor(min / 60);
  if (h < 24) return pick(locale, `za ${h} h ${min % 60} min`, `o ${h} h ${min % 60} min`, `in ${h} h ${min % 60} min`);
  const days = Math.round(h / 24);
  return pick(locale, `za ${days} d`, `o ${days} d`, `in ${days} d`);
}

const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const SOURCE_LABEL: Record<LiveEntry["source"], string> = { lol: "LoL", steam: "Steam", discord: "Discord" };

export default async function Home() {
  const inApp = (await headers()).get("user-agent")?.includes("PlayHavenApp") ?? false;
  const { t, locale } = await getT();
  const session = await auth();
  const user = session?.user;
  const now = new Date();

  const [tournaments, customs, lfg, games, accounts, live, latestNews] = await Promise.all([
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
    db.game.findMany({ orderBy: { sortOrder: "asc" } }),
    user ? db.linkedAccount.findMany({ where: { userId: user.id } }) : Promise.resolve([]),
    getLiveNow().catch(() => [] as LiveEntry[]),
    db.news.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 3 }).catch(() => []),
  ]);

  const steam = accounts.find((a) => a.provider === "steam");
  const riot = accounts.find((a) => a.provider === "riot");
  const myLol = riot ? await peekLolProfile(riot.externalId, riot.region ?? DEFAULT_PLATFORM) : null;

  /* Nejbližší akce do hero banneru: turnaj má přednost před customkou */
  const nextT = tournaments[0];
  const nextC = customs[0];
  const feature =
    nextT && (!nextC || nextT.startsAt <= nextC.startsAt) ? { kind: "t" as const, x: nextT }
    : nextC ? { kind: "c" as const, x: nextC }
    : nextT ? { kind: "t" as const, x: nextT }
    : null;

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

  const liveFor = (name: string) => {
    const n = normGame(name);
    return live.filter((e) => {
      const g = normGame(e.game);
      return g.includes(n) || n.includes(g);
    }).length;
  };

  return (
    <div className="space-y-8">
      {/* Pozdrav a počet hráčů online */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold md:text-3xl">
          {user ? `${greeting}, ${firstName}` : "Play Haven"}
        </h1>
        <span className="inline-flex items-center gap-2 rounded-[3px] bg-ink-800 px-3 py-1.5 text-sm text-slate-300">
          <span className="live-dot" aria-hidden="true" />
          <span className="num text-bone">{live.length}</span>
          {pick(locale, "hráčů právě hraje", "hráčov práve hrá", "players in game now")}
        </span>
      </div>

      {user && <Onboarding userId={user.id} locale={locale} />}

      {latestNews.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{pick(locale, "Novinky", "Novinky", "News")}</h2>
            <Link href="/news" className="text-sm text-violet-300 hover:underline">{pick(locale, "Všechny", "Všetky", "All")}</Link>
          </div>
          <NewsList items={latestNews} locale={locale} />
        </section>
      )}

      {/* Hero: nejbližší akce */}
      <section className="panel panel-edge relative isolate min-h-[300px] overflow-hidden">
        {feature && (
          <GameImage
            src={feature.x.game.imageUrl}
            name={feature.x.game.name}
            className="absolute inset-0 -z-10 h-full w-full object-cover opacity-45"
          />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-950 via-ink-950/75 to-ink-950/10" />
        <div className="grid h-full gap-8 p-7 md:grid-cols-[1fr_auto] md:items-end md:p-10">
          {feature ? (
            <>
              <div className="max-w-2xl">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-accent-soft">
                  {inText(locale, feature.x.startsAt) === pick(locale, "právě začíná", "práve začína", "starting now") && (
                    <span className="live-dot" aria-hidden="true" />
                  )}
                  {feature.kind === "t"
                    ? pick(locale, "Nejbližší turnaj", "Najbližší turnaj", "Next tournament")
                    : pick(locale, "Nejbližší customka", "Najbližšia customka", "Next custom")}
                </p>
                <h2 className="mt-2 text-4xl font-bold uppercase leading-[0.95] md:text-6xl">
                  {feature.kind === "t" ? (feature.x as typeof nextT).name : (feature.x as typeof nextC).title}
                </h2>
                <p className="mt-3 text-slate-300">
                  {feature.x.game.name}, {slot(locale, feature.x.startsAt).day} {slot(locale, feature.x.startsAt).date} v{" "}
                  {slot(locale, feature.x.startsAt).time}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href={feature.kind === "t" ? "/tournaments" : "/customs"} className="btn">
                    {pick(locale, "Přidat se", "Pridať sa", "Join")}
                  </Link>
                  <Link href={feature.kind === "t" ? "/tournaments" : "/customs"} className="btn-ghost">
                    {pick(locale, "Detaily", "Detaily", "Details")}
                  </Link>
                </div>
              </div>
              <div className="md:text-right">
                <p className="text-sm text-slate-400">{pick(locale, "Začíná", "Začína", "Starts")}</p>
                <p className="num text-4xl text-white md:text-5xl">{inText(locale, feature.x.startsAt)}</p>
                <p className="mt-2 text-sm text-slate-300">
                  <span className="num text-bone">{feature.x._count.entries}</span>/{feature.x.maxPlayers}{" "}
                  {pick(locale, "hráčů", "hráčov", "players")}
                </p>
              </div>
            </>
          ) : (
            <div className="max-w-xl">
              <h2 className="text-4xl font-bold uppercase leading-[0.95] md:text-5xl">
                {user ? pick(locale, "Dnes je volno", "Dnes je voľno", "Nothing planned") : t("hub_guest_title")}
              </h2>
              <p className="mt-3 text-slate-300">
                {user
                  ? pick(locale, "Založ customku nebo najdi partu a rozjeď večer.", "Založ customku alebo nájdi partiu a rozbehni večer.", "Start a custom or find a squad and get the evening going.")
                  : t("hub_guest_text")}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {user ? (
                  <>
                    <Link href="/customs" className="btn">{pick(locale, "Založit customku", "Založiť customku", "Create a custom")}</Link>
                    <Link href="/lfg" className="btn-ghost">{t("hub_find_party")}</Link>
                  </>
                ) : (
                  <form
                    action={async () => {
                      "use server";
                      await signIn("discord", { redirectTo: "/" });
                    }}
                  >
                    <button className="btn">{t("login")}</button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Hledání hráče */}
      <section aria-label={pick(locale, "Hledání hráče", "Hľadanie hráča", "Player search")}>
        <LolSearch locale={locale} />
      </section>

      {/* Rychlé akce */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { href: "/lfg", title: t("hub_find_party"), text: pick(locale, "Najdi partu na dnešek", "Nájdi partiu na dnes", "Find a squad for tonight"),
            icon: <Icon><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17.5" cy="9" r="2.5" /><path d="M16 14.3c3 .2 5 2.3 5 5.7" /></Icon> },
          { href: "/customs", title: pick(locale, "Založit customku", "Založiť customku", "Create a custom"), text: pick(locale, "Vlastní hra pro kohokoliv", "Vlastná hra pre kohokoľvek", "Your own game, open to all"),
            icon: <Icon><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M12 8v8M8 12h8" /></Icon> },
          { href: "/lookup", title: pick(locale, "Statistiky hráčů", "Štatistiky hráčov", "Player stats"), text: pick(locale, "LoL profil se vším", "LoL profil so všetkým", "Full LoL profiles"),
            icon: <Icon><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Icon> },
          { href: "/tournaments", title: t("tournaments"), text: pick(locale, "Přihlas se a soutěž", "Prihlás sa a súťaž", "Sign up and compete"),
            icon: <Icon><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M9 20h6M12 14v6" /></Icon> },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="card group flex items-start gap-3 p-4 transition hover:border-accent hover:bg-ink-700">
            <span className="mt-0.5 text-accent-soft transition group-hover:text-white">{a.icon}</span>
            <span className="min-w-0">
              <span className="block font-display text-base font-semibold text-bone">{a.title}</span>
              <span className="mt-0.5 block text-sm text-slate-400">{a.text}</span>
            </span>
          </Link>
        ))}
      </section>


      {/* Aplikace pro počítač */}
      {!inApp && (
        <section className="card flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-bone">
              {pick(locale, "Play Haven pro počítač", "Play Haven pre počítač", "Play Haven for desktop")}
            </p>
            <p className="text-sm text-slate-400">
              {pick(locale, "Scouting spoluhráčů a nepřátel přímo z champ selectu. Jeden soubor, bez instalace.", "Scouting spoluhráčov a nepriateľov priamo z champ selectu. Jeden súbor, bez inštalácie.", "Scouting teammates and enemies straight from champ select. One file, no install.")}
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/api/download" className="btn">{pick(locale, "Stáhnout", "Stiahnuť", "Download")}</a>
            <Link href="/live" className="btn-ghost">{pick(locale, "Více", "Viac", "More")}</Link>
          </div>
        </section>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-8">
          {/* Právě hrají */}
          <section>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-xl font-semibold">{pick(locale, "Právě hrají", "Práve hrajú", "In game now")}</h2>
              <span className="hud-line flex-1" aria-hidden="true" />
            </div>
            {!user ? (
              <div className="card p-5 text-sm text-slate-300">
                {pick(
                  locale,
                  `Právě hraje ${live.length} hráčů. Přihlas se přes Discord a uvidíš, kdo a co.`,
                  `Práve hrá ${live.length} hráčov. Prihlás sa cez Discord a uvidíš, kto a čo.`,
                  `${live.length} players are in a game right now. Sign in with Discord to see who and what.`
                )}
              </div>
            ) : live.length === 0 ? (
              <div className="card p-5 text-sm text-slate-400">
                {pick(
                  locale,
                  "Zrovna nikdo nehraje. Propojené účty a Discord ukážou aktivitu hned, jak někdo spustí hru.",
                  "Práve nikto nehrá. Prepojené účty a Discord ukážu aktivitu hneď, ako niekto spustí hru.",
                  "Nobody is in a game right now. Linked accounts and Discord show activity as soon as someone launches a game."
                )}
              </div>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {live.slice(0, 8).map((e) => (
                  <li key={e.userId}>
                    <Link href={`/players/${e.handle}`} className="card flex items-center gap-3 p-3 transition hover:border-accent hover:bg-ink-700">
                      {e.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
                      ) : (
                        <span className="h-10 w-10 rounded-full bg-ink-600" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-bone">{e.username}</span>
                        <span className="block truncate text-sm text-pulse">{e.game}</span>
                        {e.detail && <span className="block truncate text-xs text-slate-400">{e.detail}</span>}
                      </span>
                      <span className="badge shrink-0">{SOURCE_LABEL[e.source]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Hry */}
          <section>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-xl font-semibold">{t("games")}</h2>
              <span className="hud-line flex-1" aria-hidden="true" />
              <Link href="/games" className="text-sm text-accent-soft hover:text-white">{t("viewAll")}</Link>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {games.map((g) => {
                const n = liveFor(g.name);
                return (
                  <Link
                    key={g.id}
                    href={`/games/${g.slug}`}
                    className="group relative block aspect-[4/3] overflow-hidden rounded-[3px] border border-ink-600/70 bg-ink-900 transition hover:border-accent"
                  >
                    <GameImage src={g.imageUrl} name={g.name} className="h-full w-full transition duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/20 to-transparent" />
                    {n > 0 && (
                      <span className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-[3px] bg-ink-950/80 px-2 py-1 text-xs text-bone">
                        <span className="live-dot" aria-hidden="true" />
                        <span className="num">{n}</span>
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="font-display text-base font-semibold leading-tight text-white">{g.name}</p>
                      <p className="text-xs text-slate-300">{g.category}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-8">
          {/* Můj profil a rank */}
          <section className="panel panel-edge p-5">
            {user ? (
              <>
                <div className="flex items-center gap-3">
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt="" className="h-12 w-12 rounded-full" />
                  ) : (
                    <span className="h-12 w-12 rounded-full bg-ink-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-bold text-bone">{user.name}</p>
                    <Link href={`/players/${user.handle}`} className="text-sm text-accent-soft hover:text-white">{t("nav_profile")}</Link>
                  </div>
                </div>

                <div className="mt-5 rounded-[3px] bg-ink-950/60 p-4">
                  <p className="text-xs text-slate-400">LoL, Solo/Duo</p>
                  {myLol?.solo ? (
                    <>
                      <div className="mt-1 flex items-baseline justify-between">
                        <RankTag
                          tier={myLol.solo.tier}
                          sub={["MASTER", "GRANDMASTER", "CHALLENGER"].includes(myLol.solo.tier) ? "" : myLol.solo.division}
                        />
                        <span className="num text-xl text-bone">{myLol.solo.lp} LP</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {myLol.solo.wins}W {myLol.solo.losses}L,{" "}
                        {Math.round((myLol.solo.wins / Math.max(1, myLol.solo.wins + myLol.solo.losses)) * 100)} %
                      </p>
                    </>
                  ) : riot ? (
                    <p className="mt-1 text-sm text-slate-300">
                      {riot.displayName}, {PLATFORMS[riot.region ?? ""]?.label ?? riot.region}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-400">
                      {pick(locale, "Propoj Riot ID a uvidíš tady svůj rank.", "Prepoj Riot ID a uvidíš tu svoj rank.", "Link your Riot ID to see your rank here.")}
                    </p>
                  )}
                </div>

                <ul className="mt-3 space-y-2 text-sm">
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Steam</span>
                    <span className="truncate font-medium text-bone">{steam ? steam.displayName : pick(locale, "Nepropojeno", "Neprepojené", "Not linked")}</span>
                  </li>
                </ul>

                <Link href={riot ? `/lol/${riot.region ?? DEFAULT_PLATFORM}/${encodeURIComponent(riot.gameName ?? "")}-${encodeURIComponent(riot.tagLine ?? "")}` : "/account"} className="btn mt-5 w-full">
                  {riot ? pick(locale, "Moje LoL statistiky", "Moje LoL štatistiky", "My LoL stats") : pick(locale, "Propojit herní účty", "Prepojiť herné účty", "Link game accounts")}
                </Link>
                {riot && steam ? null : riot ? (
                  <Link href="/account" className="mt-2 block text-center text-sm text-accent-soft hover:text-white">
                    {pick(locale, "Propojit Steam", "Prepojiť Steam", "Link Steam")}
                  </Link>
                ) : null}
              </>
            ) : (
              <div className="space-y-4 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/logo-full.png" alt="Play Haven" className="mx-auto w-40" />
                <p className="text-sm leading-relaxed text-slate-300">{t("hub_progress_guest")}</p>
                <form
                  action={async () => {
                    "use server";
                    await signIn("discord", { redirectTo: "/" });
                  }}
                >
                  <button className="btn w-full">{t("login")}</button>
                </form>
              </div>
            )}
          </section>

          {/* Chystá se */}
          <section>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-xl font-semibold">{t("hub_happening")}</h2>
              <span className="hud-line flex-1" aria-hidden="true" />
            </div>
            {events.length === 0 ? (
              <p className="card p-4 text-sm text-slate-400">{t("noData")}</p>
            ) : (
              <ul className="divide-y divide-ink-600/60 border-y border-ink-600/60">
                {events.map((e) => {
                  const s = slot(locale, e.startsAt);
                  const free = Math.max(0, e.max - e.entries);
                  return (
                    <li key={e.key}>
                      <Link href={e.href} className="flex items-center gap-3 py-3 transition hover:bg-ink-800/60">
                        <div className="w-14 shrink-0 text-center">
                          <p className="text-xs text-slate-400">{s.day} {s.date}</p>
                          <p className="num text-lg text-accent-soft">{s.time}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display font-semibold text-bone">{e.title}</p>
                          <p className="truncate text-xs text-slate-400">{e.kind}, {e.game}</p>
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

          {/* LFG */}
          <section>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-xl font-semibold">{t("lfg")}</h2>
              <span className="hud-line flex-1" aria-hidden="true" />
              <Link href="/lfg" className="text-sm text-accent-soft hover:text-white">{t("viewAll")}</Link>
            </div>
            {lfg.length === 0 ? (
              <p className="card p-4 text-sm text-slate-400">{t("noData")}</p>
            ) : (
              <ul className="divide-y divide-ink-600/60 border-y border-ink-600/60">
                {lfg.map((p) => (
                  <li key={p.id}>
                    <Link href="/lfg" className="flex items-center gap-3 py-3 transition hover:bg-ink-800/60">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display font-semibold text-bone">{p.title}</p>
                        <p className="truncate text-xs text-slate-400">{p.game.name}, {p.author.username}</p>
                      </div>
                      <span className="badge shrink-0 text-pulse">{p._count.joins + 1}/{p.slots}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
