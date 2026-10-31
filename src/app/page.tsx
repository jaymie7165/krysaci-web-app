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
import PetSprite from "@/components/PetSprite";
import { asSpecies, condition, levelFromXp, parseGear, shownStage, STAGE_NAMES } from "@/lib/pet";

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

  const [tournaments, customs, lfg, games, accounts, live, latestNews, userCount, lfgOpen, esports] = await Promise.all([
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
      take: 6,
      include: { game: true, author: true, _count: { select: { joins: true } } },
    }),
    db.game.findMany({ orderBy: { sortOrder: "asc" } }),
    user ? db.linkedAccount.findMany({ where: { userId: user.id } }) : Promise.resolve([]),
    getLiveNow().catch(() => [] as LiveEntry[]),
    db.news.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 4 }).catch(() => []),
    db.user.count().catch(() => 0),
    db.lfgPost.count({ where: { open: true } }).catch(() => 0),
    db.esportsMatch.findMany({ where: { OR: [{ status: "live" }, { status: "upcoming", startsAt: { gte: now } }] }, orderBy: { startsAt: "asc" }, take: 4 }).catch(() => []),
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

  const pet = user ? await db.pet.findUnique({ where: { userId: user.id } }).catch(() => null) : null;
  const topGames = [...games].sort((a, b) => liveFor(b.name) - liveFor(a.name)).slice(0, 6);
  const Head = ({ title, href, more }: { title: string; href?: string; more?: string }) => (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold">{title}</h2>
      {href && <Link href={href} className="text-sm font-medium text-accent-soft hover:text-white">{more ?? t("viewAll")} →</Link>}
    </div>
  );
  const stat = (n: number, label: string, icon: ReactNode) => (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent-soft">{icon}</span>
      <span className="leading-tight"><span className="num block text-xl text-white">{n.toLocaleString(tag(locale))}</span><span className="text-xs text-slate-400">{label}</span></span>
    </div>
  );

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-8">
        {user && <Onboarding userId={user.id} locale={locale} />}

        {/* Hero */}
        <section className="hero-art relative flex min-h-[420px] flex-col justify-center overflow-hidden rounded-3xl border border-ink-600/50 p-7 md:min-h-[480px] md:p-12 2xl:min-h-[540px]">
          <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.02] md:text-6xl 2xl:text-7xl">
            {pick(locale, "Hry jsou lepší", "Hry sú lepšie", "Games are better")}
            <span className="block text-accent">{pick(locale, "společně.", "spoločne.", "together.")}</span>
          </h1>
          <p className="mt-4 max-w-lg text-lg text-slate-200">
            {user ? `${greeting}, ${firstName}. ` : ""}
            {pick(locale, "Najdi si spoluhráče, objev nové hry a buď součástí komunity, kde se hraje, baví a vznikají nové příběhy.", "Nájdi si spoluhráčov, objav nové hry a buď súčasťou komunity, kde sa hrá, baví a vznikajú nové príbehy.", "Find teammates, discover new games and join a community where people play, have fun and make stories.")}
          </p>
          <form action="/search" className="mt-7 flex max-w-2xl flex-col gap-2 rounded-2xl border border-ink-600/60 bg-ink-900/80 p-1.5 backdrop-blur sm:flex-row">
            <input name="q" aria-label={pick(locale, "Hledat", "Hľadať", "Search")} placeholder={pick(locale, "Co si dnes zahraješ?", "Čo si dnes zahráš?", "What are you playing today?")} className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-white placeholder:text-slate-400 focus:outline-none" />
            <Link href="/lfg" className="btn">{pick(locale, "Najít spoluhráče", "Nájsť spoluhráčov", "Find teammates")} →</Link>
          </form>
          {!user && (
            <form action={async () => { "use server"; await signIn("discord", { redirectTo: "/" }); }} className="mt-4">
              <button className="btn-ghost">{t("login")}</button>
            </form>
          )}
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
            {stat(userCount, pick(locale, "registrovaných hráčů", "registrovaných hráčov", "registered players"),
              <Icon><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.300 2.700-6 6-6s6 2.700 6 6" /><circle cx="17.500" cy="9" r="2.500" /></Icon>)}
            {stat(lfgOpen, pick(locale, "hledá spoluhráče", "hľadá spoluhráčov", "looking for players"),
              <Icon><circle cx="11" cy="11" r="6.500" /><path d="m20 20-4.200-4.200" /></Icon>)}
            {stat(live.length, pick(locale, "právě hraje", "práve hrá", "playing now"),
              <Icon><rect x="3" y="6" width="18" height="12" rx="3" /><path d="M8 10v4M6 12h4M16 11v.01M18 13v.01" /></Icon>)}
          </div>
        </section>

        {/* Nejbližší akce */}
        {feature && (
          <Link href={feature.kind === "t" ? "/tournaments" : "/customs"} className="card flex flex-wrap items-center gap-4 p-4 transition hover:border-accent">
            <GameImage src={feature.x.game.imageUrl} name={feature.x.game.name} className="h-14 w-24 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent-soft">
                {feature.kind === "t" ? pick(locale, "Nejbližší turnaj", "Najbližší turnaj", "Next tournament") : pick(locale, "Nejbližší customka", "Najbližšia customka", "Next custom")}
              </p>
              <p className="truncate text-lg font-bold text-white">{feature.kind === "t" ? (feature.x as typeof nextT).name : (feature.x as typeof nextC).title}</p>
              <p className="text-sm text-slate-400">{feature.x.game.name} · {slot(locale, feature.x.startsAt).day} {slot(locale, feature.x.startsAt).date} {slot(locale, feature.x.startsAt).time}</p>
            </div>
            <div className="text-right">
              <p className="num text-2xl text-white">{inText(locale, feature.x.startsAt)}</p>
              <p className="text-xs text-slate-400">{feature.x._count.entries}/{feature.x.maxPlayers} {pick(locale, "hráčů", "hráčov", "players")}</p>
            </div>
          </Link>
        )}

        {/* Oblíbené hry */}
        <section>
          <Head title={pick(locale, "Oblíbené hry v komunitě", "Obľúbené hry v komunite", "Popular games")} href="/games" more={pick(locale, "Zobrazit všechny hry", "Zobraziť všetky hry", "All games")} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {topGames.map((g) => {
              const n = liveFor(g.name);
              return (
                <Link key={g.id} href={`/games/${g.slug}`} className="group relative block aspect-[3/4] overflow-hidden rounded-2xl border border-ink-600/50 bg-ink-900 transition hover:border-accent">
                  <GameImage src={g.imageUrl} name={g.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="text-sm font-bold leading-tight text-white">{g.name}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-300"><span className="live-dot" aria-hidden="true" />{n} online</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* LFG */}
        <section>
          <Head title={pick(locale, "LFG – Lidé hledají spoluhráče", "LFG – Ľudia hľadajú spoluhráčov", "LFG – players looking for teammates")} href="/lfg" more={pick(locale, "Zobrazit vše", "Zobraziť všetko", "View all")} />
          {lfg.length === 0 ? (
            <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
              <p className="text-slate-300">{pick(locale, "Zatím nikdo nehledá spoluhráče. Buď první a založ hledání.", "Zatiaľ nikto nehľadá spoluhráčov. Buď prvý a založ hľadanie.", "Nobody is looking yet. Be the first to post.")}</p>
              <Link href="/lfg" className="btn">{pick(locale, "Založit LFG", "Založiť LFG", "Post LFG")}</Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {lfg.map((p) => (
                <article key={p.id} className="card flex flex-col gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <GameImage src={p.game.imageUrl} name={p.game.name} className="h-11 w-11 rounded-xl object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{p.game.name}</p>
                      <p className="truncate text-xs text-slate-400">{p.author.username}{p.rankHint ? ` · ${p.rankHint}` : ""}</p>
                    </div>
                    <span className="ml-auto rounded-lg bg-accent/15 px-2 py-1 text-xs font-bold text-accent-soft">{p._count.joins + 1}/{p.slots}</span>
                  </div>
                  <p className="font-semibold text-white">{p.title}</p>
                  {p.description && <p className="line-clamp-2 text-sm text-slate-400">{p.description}</p>}
                  <Link href="/lfg" className="btn mt-auto">{pick(locale, "Přidat se", "Pridať sa", "Join")} →</Link>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Chystá se */}
        <section>
          <Head title={t("hub_happening")} href="/tournaments" more={pick(locale, "Turnaje a customky", "Turnaje a customky", "Tournaments & customs")} />
          {events.length === 0 ? (
            <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
              <p className="text-slate-300">{pick(locale, "Zatím není nic naplánováno. Založ customku nebo počkej na turnaj.", "Zatiaľ nie je nič naplánované. Založ customku alebo počkaj na turnaj.", "Nothing planned yet. Start a custom or wait for a tournament.")}</p>
              <Link href="/customs" className="btn">{pick(locale, "Založit customku", "Založiť customku", "Create a custom")}</Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              {events.map((e) => {
                const sl = slot(locale, e.startsAt);
                const free = Math.max(0, e.max - e.entries);
                return (
                  <Link key={e.key} href={e.href} className="card flex flex-col gap-2 p-4 transition hover:border-accent">
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent-soft">{e.kind} · {e.game}</p>
                    <p className="font-bold text-white">{e.title}</p>
                    <p className="text-sm text-slate-400">{sl.day} {sl.date} · {sl.time} · {inText(locale, e.startsAt)}</p>
                    <span className={`badge mt-auto w-fit ${free === 0 ? "text-ember" : ""}`}>{free === 0 ? t("full") : `${free} ${t("hub_free")}`}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Právě hrají */}
        <section>
          <Head title={pick(locale, "Komunita právě teď", "Komunita práve teraz", "Community right now")} href="/now" more={pick(locale, "Více", "Viac", "More")} />
          {!user ? (
            <div className="card p-5 text-sm text-slate-300">
              {pick(locale, `Právě hraje ${live.length} hráčů. Přihlas se přes Discord a uvidíš, kdo a co.`, `Práve hrá ${live.length} hráčov. Prihlás sa cez Discord a uvidíš, kto a čo.`, `${live.length} players are in a game right now. Sign in with Discord to see who and what.`)}
            </div>
          ) : live.length === 0 ? (
            <div className="card p-5 text-sm text-slate-400">
              {pick(locale, "Zrovna nikdo nehraje. Aktivita se ukáže, jakmile někdo spustí hru.", "Práve nikto nehrá. Aktivita sa ukáže, hneď ako niekto spustí hru.", "Nobody is playing right now. Activity shows up as soon as someone launches a game.")}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              {live.slice(0, 8).map((e) => (
                <li key={e.userId}>
                  <Link href={`/players/${e.handle}`} className="card flex items-center gap-3 p-3 transition hover:border-accent">
                    {e.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
                    ) : (<span className="h-10 w-10 rounded-full bg-ink-600" />)}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{e.username}</span>
                      <span className="block truncate text-xs text-pulse">{e.game}</span>
                      {e.detail && <span className="block truncate text-xs text-slate-400">{e.detail}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!inApp && (
          <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="font-bold text-white">{pick(locale, "Play Haven pro počítač", "Play Haven pre počítač", "Play Haven for desktop")}</p>
              <p className="text-sm text-slate-400">{pick(locale, "Scouting spoluhráčů a nepřátel přímo z champ selectu. Jeden soubor, bez instalace.", "Scouting spoluhráčov a nepriateľov priamo z champ selectu. Jeden súbor, bez inštalácie.", "Scouting teammates and enemies straight from champ select. One file, no install.")}</p>
            </div>
            <div className="flex gap-2">
              <a href="/api/download" className="btn">{pick(locale, "Stáhnout", "Stiahnuť", "Download")}</a>
              <Link href="/live" className="btn-ghost">{pick(locale, "Více", "Viac", "More")}</Link>
            </div>
          </section>
        )}

        <section aria-label={pick(locale, "Hledání hráče", "Hľadanie hráča", "Player search")}>
          <LolSearch locale={locale} />
        </section>
      </div>

      {/* Pravý panel */}
      <aside className="space-y-6">
        {user && (
          <section className="card space-y-3 p-4">
            <div className="flex items-center gap-3">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="h-11 w-11 rounded-full" />
              ) : (<span className="h-11 w-11 rounded-full bg-ink-600" />)}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white">{user.name}</p>
                <Link href={`/players/${user.handle}`} className="text-xs text-accent-soft hover:text-white">{t("nav_profile")}</Link>
              </div>
            </div>
            <div className="rounded-xl bg-ink-950/50 p-3">
              <p className="text-xs text-slate-400">LoL, Solo/Duo</p>
              {myLol?.solo ? (
                <div className="mt-1 flex items-baseline justify-between">
                  <RankTag tier={myLol.solo.tier} sub={["MASTER", "GRANDMASTER", "CHALLENGER"].includes(myLol.solo.tier) ? "" : myLol.solo.division} />
                  <span className="num text-lg text-white">{myLol.solo.lp} LP</span>
                </div>
              ) : riot ? (
                <p className="mt-1 text-sm text-slate-300">{riot.displayName}, {PLATFORMS[riot.region ?? ""]?.label ?? riot.region}</p>
              ) : (
                <p className="mt-1 text-sm text-slate-400">{pick(locale, "Propoj Riot ID a uvidíš tady svůj rank.", "Prepoj Riot ID a uvidíš tu svoj rank.", "Link your Riot ID to see your rank here.")}</p>
              )}
            </div>
            <p className="flex justify-between text-sm"><span className="text-slate-400">Steam</span><span className="truncate font-medium text-bone">{steam ? steam.displayName : pick(locale, "Nepropojeno", "Neprepojené", "Not linked")}</span></p>
            <Link href={riot ? `/lol/${riot.region ?? DEFAULT_PLATFORM}/${encodeURIComponent(riot.gameName ?? "")}-${encodeURIComponent(riot.tagLine ?? "")}` : "/account"} className="btn w-full">
              {riot ? pick(locale, "Moje LoL statistiky", "Moje LoL štatistiky", "My LoL stats") : pick(locale, "Propojit herní účty", "Prepojiť herné účty", "Link game accounts")}
            </Link>
          </section>
        )}

        {user && (
          <Link href="/pet" className="card flex items-center gap-3 p-4 transition hover:border-accent">
            {pet ? (() => {
              const c = condition(pet.lastFedAt);
              const lv = levelFromXp(pet.xp);
              const st = shownStage(lv, c.penalty);
              return (
                <>
                  <PetSprite species={asSpecies(pet.species)} stage={st} mood={c.mood} penalty={c.penalty} gear={parseGear(pet.gear)} size={96} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-white">{pet.name}</span>
                    <span className="block text-xs text-slate-400">{STAGE_NAMES[asSpecies(pet.species)][st][locale === "cs" ? 0 : locale === "sk" ? 1 : 2]} · {pick(locale, "úroveň", "úroveň", "level")} {lv}</span>
                    <span className={`mt-1 block text-xs font-semibold ${c.penalty > 0 || c.mood === "hungry" ? "text-ember" : "text-pulse"}`}>
                      {c.mood === "hungry" || c.penalty > 0 ? pick(locale, "Má hlad, nakrm ho", "Je hladný, nakŕm ho", "Hungry, feed it") : pick(locale, "Je v pohodě", "Je v pohode", "Doing fine")} · 🍖 {pet.treats}
                    </span>
                  </span>
                </>
              );
            })() : (
              <span className="text-sm text-slate-300"><span className="block font-bold text-white">{pick(locale, "Vyber si peta", "Vyber si peta", "Pick a pet")}</span>{pick(locale, "Roste, když hraješ.", "Rastie, keď hráš.", "Grows when you play.")}</span>
            )}
          </Link>
        )}

        <section className="card p-4">
          <Head title={pick(locale, "Právě se hraje", "Práve sa hrá", "Playing now")} href="/now" more={pick(locale, "Zobrazit vše", "Zobraziť všetko", "View all")} />
          <ul className="space-y-2">
            {topGames.slice(0, 4).map((g) => (
              <li key={g.id}>
                <Link href={`/games/${g.slug}`} className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-ink-700/60">
                  <GameImage src={g.imageUrl} name={g.name} className="h-11 w-11 rounded-lg object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{g.name}</span>
                    <span className="block text-xs text-slate-400">{g.category}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-300"><span className="live-dot" aria-hidden="true" />{liveFor(g.name)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-4">
          <Head title={pick(locale, "Aktuálně v esportu", "Aktuálne v esporte", "Esports now")} href="/esports" more={pick(locale, "Zobrazit vše", "Zobraziť všetko", "View all")} />
          {esports.length === 0 ? (
            <p className="text-sm text-slate-400">{t("noData")}</p>
          ) : (
            <ul className="space-y-2">
              {esports.map((m) => (
                <li key={m.id}>
                  <Link href="/esports" className="block rounded-xl bg-ink-950/40 p-3 transition hover:bg-ink-700/60">
                    <p className="flex items-center justify-between text-xs text-slate-400">
                      <span>{m.league}</span>
                      {m.status === "live" ? <span className="flex items-center gap-1 font-semibold text-ember"><span className="live-dot !bg-ember" />LIVE</span> : <span>{inText(locale, m.startsAt)}</span>}
                    </p>
                    <p className="mt-1 flex items-center justify-between text-sm font-bold text-white">
                      <span className="truncate">{m.teamA}</span>
                      <span className="px-2 text-xs text-slate-500">{m.status === "live" ? `${m.scoreA ?? 0}:${m.scoreB ?? 0}` : "vs"}</span>
                      <span className="truncate text-right">{m.teamB}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <Head title={pick(locale, "Novinky", "Novinky", "News")} href="/news" more={pick(locale, "Zobrazit vše", "Zobraziť všetko", "View all")} />
          {latestNews.length === 0 ? (
            <p className="text-sm text-slate-400">{pick(locale, "Zatím žádné novinky.", "Zatiaľ žiadne novinky.", "No news yet.")}</p>
          ) : (
            <ul className="space-y-3">
              {latestNews.map((n) => (
                <li key={n.id}>
                  <Link href="/news" className="block rounded-xl p-1.5 transition hover:bg-ink-700/60">
                    <p className="text-sm font-semibold text-white">{n.pinned && "📌 "}{n.title}</p>
                    <p className="line-clamp-2 text-xs text-slate-400">{n.body}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
