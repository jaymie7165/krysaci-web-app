import Link from "next/link";
import { db } from "@/lib/db";
import { auth, signIn } from "@/lib/auth";
import { getT, dateFmt } from "@/lib/i18n";
import GameCard from "@/components/GameCard";

export default async function Home() {
  const { t, locale } = await getT();
  const session = await auth();
  const [games, tournaments, lfg, playerCount] = await Promise.all([
    db.game.findMany({ orderBy: { sortOrder: "asc" } }),
    db.tournament.findMany({
      where: { status: "UPCOMING", startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 3,
      include: { game: true, _count: { select: { entries: true } } },
    }),
    db.lfgPost.findMany({
      where: { open: true },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { game: true, author: true },
    }),
    db.user.count(),
  ]);

  return (
    <div className="space-y-14">
      <section className="py-10 text-center">
        <p className="mb-3 font-display text-sm uppercase tracking-[0.3em] text-pulse">CZ · SK · EN</p>
        <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight md:text-6xl">{t("heroTitle")}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">{t("heroText")}</p>
        <div className="mt-8 flex justify-center gap-3">
          {!session?.user && (
            <form
              action={async () => {
                "use server";
                await signIn("discord", { redirectTo: "/" });
              }}
            >
              <button className="btn px-6 py-3 text-base">{t("login")}</button>
            </form>
          )}
          <Link href="/games" className="btn-ghost px-6 py-3 text-base">
            {t("nav_games")}
          </Link>
        </div>
        <p className="mt-6 text-sm text-slate-500">
          {playerCount} {t("players_short")}
        </p>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-3xl font-semibold">{t("games")}</h2>
          <Link href="/games" className="text-sm text-accent-soft hover:text-white">{t("viewAll")} →</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-2xl font-semibold">{t("tournaments")}</h2>
            <Link href="/tournaments" className="text-sm text-accent-soft hover:text-white">{t("viewAll")} →</Link>
          </div>
          <div className="space-y-3">
            {tournaments.length === 0 && <p className="text-slate-500">{t("noData")}</p>}
            {tournaments.map((x) => (
              <Link key={x.id} href="/tournaments" className="card block p-4 transition hover:border-accent">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{x.name}</h3>
                  <span className="badge">{x.game.name}</span>
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  {dateFmt(locale, x.startsAt)} · {x._count.entries}/{x.maxPlayers}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-2xl font-semibold">{t("lfg")}</h2>
            <Link href="/lfg" className="text-sm text-accent-soft hover:text-white">{t("viewAll")} →</Link>
          </div>
          <div className="space-y-3">
            {lfg.length === 0 && <p className="text-slate-500">{t("noData")}</p>}
            {lfg.map((p) => (
              <Link key={p.id} href="/lfg" className="card block p-4 transition hover:border-accent">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{p.title}</h3>
                  <span className="badge">{p.game.name}</span>
                </div>
                <p className="mt-1 text-sm text-slate-400">{p.author.username}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
