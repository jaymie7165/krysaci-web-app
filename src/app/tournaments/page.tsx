import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getT, dateFmt, type Key } from "@/lib/i18n";
import { createTournament, deleteTournament, joinTournament, leaveTournament } from "@/app/actions";
import GameSelect from "@/components/GameSelect";

export const metadata = { title: "Turnaje" };

export default async function TournamentsPage() {
  const { t, locale } = await getT();
  const session = await auth();
  const canCreate = session?.user?.role === "ADMIN";
  const [items, games] = await Promise.all([
    db.tournament.findMany({
      orderBy: { startsAt: "asc" },
      include: { game: true, organizer: true, entries: { select: { userId: true } } },
    }),
    canCreate ? db.game.findMany({ orderBy: { sortOrder: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">{t("tournaments")}</h1>

      {canCreate && (
        <form action={createTournament} className="card grid gap-3 p-5 md:grid-cols-2">
          <div><label className="label">{t("game")}</label><GameSelect games={games} /></div>
          <div><label className="label">{t("title")}</label><input name="name" required minLength={3} maxLength={80} className="input" /></div>
          <div><label className="label">{t("date")}</label><input type="datetime-local" name="startsAt" required className="input" /></div>
          <div><label className="label">{t("maxPlayers")}</label><input type="number" name="maxPlayers" defaultValue={16} min={2} max={256} className="input" /></div>
          <div><label className="label">{t("prize")}</label><input name="prize" maxLength={100} className="input" /></div>
          <div className="md:col-span-2"><label className="label">{t("description")}</label><textarea name="description" required rows={3} maxLength={1000} className="input" /></div>
          <div><button className="btn">{t("create")}</button></div>
        </form>
      )}

      {items.length === 0 && <p className="text-slate-500">{t("noData")}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((x) => {
          const joined = !!session?.user && x.entries.some((e) => e.userId === session.user.id);
          const full = x.entries.length >= x.maxPlayers;
          return (
            <article key={x.id} className="card overflow-hidden">
              <div className="flex gap-4 p-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.game.imageUrl} alt="" className="hidden h-20 w-36 rounded object-cover sm:block" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold">{x.name}</h3>
                    <span className="badge">{t(`status_${x.status}` as Key)}</span>
                  </div>
                  <p className="text-sm text-slate-400">{x.game.name} · {dateFmt(locale, x.startsAt)}</p>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-300">{x.description}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {t("organizer")}: {x.organizer.username}
                    {x.prize ? ` · ${t("prize")}: ${x.prize}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-ink-600/60 px-5 py-3">
                <span className="flex items-center gap-3 text-sm text-slate-400">
                  {x.entries.length}/{x.maxPlayers} {t("players_short")}
                  {canCreate && (
                    <form action={deleteTournament.bind(null, x.id)}>
                      <button className="text-xs text-slate-500 hover:text-ember">Smazat</button>
                    </form>
                  )}
                </span>
                {x.status === "UPCOMING" &&
                  (session?.user ? (
                    joined ? (
                      <form action={leaveTournament.bind(null, x.id)}><button className="btn-ghost">{t("leave")}</button></form>
                    ) : full ? (
                      <span className="badge">{t("full")}</span>
                    ) : (
                      <form action={joinTournament.bind(null, x.id)}><button className="btn">{t("join")}</button></form>
                    )
                  ) : (
                    <span className="text-xs text-slate-500">{t("loginRequired")}</span>
                  ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
