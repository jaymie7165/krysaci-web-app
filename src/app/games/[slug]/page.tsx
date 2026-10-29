import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getT, dateFmt, pick } from "@/lib/i18n";
import { joinGame, leaveGame } from "@/app/actions";
import GameImage from "@/components/GameImage";
import Notice from "@/components/Notice";

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const { slug } = await params;
  const { msg } = await searchParams;
  const { t, locale } = await getT();
  const session = await auth();
  const me = session?.user;
  const game = await db.game.findUnique({ where: { slug } });
  if (!game) notFound();

  const now = new Date();
  const [profiles, tournaments, customs, lfg] = await Promise.all([
    db.gameProfile.findMany({ where: { gameId: game.id }, include: { user: true }, orderBy: { user: { lastSeenAt: "desc" } }, take: 100 }),
    db.tournament.findMany({ where: { gameId: game.id, status: "UPCOMING", startsAt: { gte: now } }, orderBy: { startsAt: "asc" }, take: 4, include: { _count: { select: { entries: true } } } }),
    db.custom.findMany({ where: { gameId: game.id, status: "UPCOMING", startsAt: { gte: now } }, orderBy: { startsAt: "asc" }, take: 4, include: { _count: { select: { entries: true } } } }),
    db.lfgPost.findMany({ where: { gameId: game.id, open: true }, orderBy: { createdAt: "desc" }, take: 4, include: { author: true } }),
  ]);
  const mine = me ? profiles.find((p) => p.userId === me.id) : undefined;

  return (
    <div className="space-y-8">
      <section className="panel panel-edge relative overflow-hidden">
        <GameImage src={game.imageUrl} name={game.name} className="absolute inset-0 h-full w-full opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/70 to-transparent" />
        <div className="relative p-6 md:p-10">
          <span className="badge">{game.category}</span>
          <h1 className="mt-2 text-4xl font-bold md:text-5xl">{game.name}</h1>
          <p className="mt-2 max-w-xl text-slate-300">{game.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/lfg`} className="btn">{t("nav_lfg")}</Link>
            <Link href={`/leaderboards?game=${game.slug}`} className="btn-ghost">{t("leaderboards")}</Link>
          </div>
        </div>
      </section>

      <Notice msg={msg} locale={locale} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section>
          <h2 className="mb-3 text-2xl font-semibold">
            {pick(locale, "Hráči ve hře", "Hráči v hre", "Players")} <span className="text-slate-500">({profiles.length})</span>
          </h2>
          {profiles.length === 0 && (
            <p className="card p-5 text-slate-400">
              {pick(locale, "Zatím tu nikdo není. Buď první a přidej se.", "Zatiaľ tu nikto nie je. Buď prvý a pridaj sa.", "Nobody here yet. Be the first to join.")}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {profiles.map((p) => (
              <Link key={p.id} href={`/players/${p.user.handle}`} className="card flex items-center gap-3 p-3 transition hover:border-accent">
                {p.user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.user.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
                ) : (
                  <span className="h-10 w-10 rounded-full bg-ink-600" />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium text-white">{p.inGameName}</span>
                  <span className="block truncate text-xs text-slate-400">
                    {p.user.username}{p.rank ? `, ${p.rank}` : ""}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          {me ? (
            <form action={joinGame.bind(null, game.id)} className="card space-y-3 p-5">
              <h2 className="text-xl font-semibold">
                {mine ? pick(locale, "Tvůj profil ve hře", "Tvoj profil v hre", "Your profile") : pick(locale, "Přidat se do hry", "Pridať sa do hry", "Join this game")}
              </h2>
              <div>
                <label className="label">{t("inGameName")}</label>
                <input name="inGameName" required maxLength={40} defaultValue={mine?.inGameName ?? ""} className="input" />
              </div>
              <div>
                <label className="label">{t("rank")}</label>
                <input name="rank" maxLength={30} defaultValue={mine?.rank ?? ""} className="input" />
              </div>
              {me.role === "ADMIN" && (
                <div>
                  <label className="label">{pick(locale, "Přidat jiného hráče (@handle, nepovinné)", "Pridať iného hráča (@handle, nepovinné)", "Add another player (@handle, optional)")}</label>
                  <input name="handle" maxLength={40} className="input" />
                </div>
              )}
              <div className="flex gap-2">
                <button className="btn">{t("save")}</button>
                {mine && (
                  <button formAction={leaveGame.bind(null, game.id)} className="btn-ghost">{pick(locale, "Odejít", "Odísť", "Leave")}</button>
                )}
              </div>
            </form>
          ) : (
            <p className="card p-5 text-sm text-slate-400">{t("loginRequired")}</p>
          )}

          {[
            { title: t("tournaments"), href: "/tournaments", rows: tournaments.map((x) => ({ id: x.id, name: x.name, at: x.startsAt, n: x._count.entries, max: x.maxPlayers })) },
            { title: t("customs"), href: "/customs", rows: customs.map((x) => ({ id: x.id, name: x.title, at: x.startsAt, n: x._count.entries, max: x.maxPlayers })) },
          ].map((blk) =>
            blk.rows.length > 0 ? (
              <section key={blk.href}>
                <h2 className="mb-2 text-lg font-semibold">{blk.title}</h2>
                <ul className="divide-y divide-ink-600/50 text-sm">
                  {blk.rows.map((r) => (
                    <li key={r.id}>
                      <Link href={blk.href} className="flex items-center justify-between gap-3 py-2 hover:text-white">
                        <span className="min-w-0">
                          <span className="block truncate text-bone">{r.name}</span>
                          <span className="block text-xs text-slate-400">{dateFmt(locale, r.at)}</span>
                        </span>
                        <span className="badge">{r.n}/{r.max}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null
          )}
          {lfg.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-semibold">{t("lfg")}</h2>
              <ul className="divide-y divide-ink-600/50 text-sm">
                {lfg.map((p) => (
                  <li key={p.id}>
                    <Link href="/lfg" className="block py-2 hover:text-white">
                      <span className="block truncate text-bone">{p.title}</span>
                      <span className="block text-xs text-slate-400">{p.author.username}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
