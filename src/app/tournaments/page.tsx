import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getT, dateFmt, pick, type Key } from "@/lib/i18n";
import {
  addTeamMember, cancelTournament, createTeam, createTournament, deleteTournament,
  joinTeam, joinTournament, leaveTournament,
} from "@/app/actions";
import GameSelect from "@/components/GameSelect";
import Notice from "@/components/Notice";

export const metadata = { title: "Turnaje" };

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { t, locale } = await getT();
  const session = await auth();
  const me = session?.user;
  const isAdmin = me?.role === "ADMIN";
  const inc = {
    game: true,
    organizer: true,
    entries: { include: { user: true } },
    teams: { include: { entries: { include: { user: true } } }, orderBy: { createdAt: "asc" as const } },
  };
  // Aktivní turnaje všechny, z ukončených a zrušených jen posledních 10 (stránka by jinak s časem jen zpomalovala).
  const [active, past, games] = await Promise.all([
    db.tournament.findMany({ where: { status: { in: ["UPCOMING", "LIVE"] } }, orderBy: { startsAt: "asc" }, include: inc }),
    db.tournament.findMany({ where: { status: { notIn: ["UPCOMING", "LIVE"] } }, orderBy: { startsAt: "desc" }, take: 10, include: inc }),
    isAdmin ? db.game.findMany({ orderBy: { sortOrder: "asc" } }) : Promise.resolve([]),
  ]);
  const items = [...active, ...past];
  // Aktivní nahoře, zrušené a skončené dole.
  const rank = (s: string) => (s === "UPCOMING" || s === "LIVE" ? 0 : 1);
  const sorted = [...items].sort((a, b) => rank(a.status) - rank(b.status));

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">{t("tournaments")}</h1>
      <p className="text-sm text-slate-400">
        <a href="/api/calendar" className="text-violet-300 hover:underline">{pick(locale, "Přidat do kalendáře (.ics)", "Pridať do kalendára (.ics)", "Add to calendar (.ics)")}</a>
        {" · "}
        <a href="/api/calendar?mine=1" className="text-violet-300 hover:underline">{pick(locale, "jen moje", "len moje", "only mine")}</a>
      </p>
      <Notice msg={msg} locale={locale} />

      {isAdmin && (
        <form action={createTournament} className="card grid gap-3 p-5 md:grid-cols-2">
          <div><label className="label">{t("game")}</label><GameSelect games={games} /></div>
          <div><label className="label">{t("title")}</label><input name="name" required minLength={3} maxLength={80} className="input" /></div>
          <div><label className="label">{t("date")}</label><input type="datetime-local" name="startsAt" required className="input" /></div>
          <div><label className="label">{t("maxPlayers")}</label><input type="number" name="maxPlayers" defaultValue={16} min={2} max={256} className="input" /></div>
          <div>
            <label className="label">{pick(locale, "Hráčů v týmu (1 = každý sám za sebe)", "Hráčov v tíme (1 = každý sám za seba)", "Players per team (1 = solo)")}</label>
            <input type="number" name="teamSize" defaultValue={1} min={1} max={10} className="input" />
          </div>
          <div><label className="label">{t("prize")}</label><input name="prize" maxLength={100} className="input" /></div>
          <div className="md:col-span-2"><label className="label">{t("description")}</label><textarea name="description" required rows={3} maxLength={1000} className="input" /></div>
          <div><button className="btn">{t("create")}</button></div>
        </form>
      )}

      {items.length === 0 && <p className="text-slate-500">{t("noData")}</p>}
      <div className="grid items-start gap-4 md:grid-cols-2">
        {sorted.map((x) => {
          const myEntry = me ? x.entries.find((e) => e.userId === me.id) : undefined;
          const joined = !!myEntry;
          const full = x.entries.length >= x.maxPlayers;
          const open = x.status === "UPCOMING";
          const teamMode = x.teamSize > 1;
          const myTeam = myEntry?.teamId ? x.teams.find((tm) => tm.id === myEntry.teamId) : undefined;
          const freeAgents = x.entries.filter((e) => !e.teamId);
          return (
            <article key={x.id} className={`card overflow-hidden ${x.status === "CANCELLED" ? "opacity-60" : ""}`}>
              <div className="flex gap-4 p-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.game.imageUrl} alt="" className="hidden h-20 w-36 rounded object-cover sm:block" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold">{x.name}</h3>
                    <span className={`badge ${x.status === "CANCELLED" ? "!bg-ember/20 text-ember" : ""}`}>{t(`status_${x.status}` as Key)}</span>
                    {teamMode && <span className="badge">{x.teamSize}v{x.teamSize}</span>}
                  </div>
                  <p className="text-sm text-slate-400">{x.game.name} · {dateFmt(locale, x.startsAt)}</p>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-300">{x.description}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {t("organizer")}: {x.organizer.username}
                    {x.prize ? ` · ${t("prize")}: ${x.prize}` : ""}
                  </p>
                </div>
              </div>

              {/* Týmy */}
              {teamMode && (x.teams.length > 0 || open) && (
                <div className="space-y-2 border-t border-ink-600/60 px-5 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {pick(locale, "Týmy", "Tímy", "Teams")} ({x.teams.length})
                  </p>
                  {x.teams.map((tm) => {
                    const mineTeam = myTeam?.id === tm.id;
                    const spots = x.teamSize - tm.entries.length;
                    const iAmCaptain = !!me && (tm.captainId === me.id || isAdmin);
                    return (
                      <div key={tm.id} className={`rounded-lg border p-3 ${mineTeam ? "border-accent bg-accent/10" : "border-ink-600/70 bg-ink-900/60"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-white">
                            {tm.name}
                            <span className="ml-2 text-xs font-normal text-slate-400">{tm.entries.length}/{x.teamSize}</span>
                          </p>
                          {open && me && !myTeam && spots > 0 && (
                            <form action={joinTeam.bind(null, tm.id)}>
                              <button className="btn-ghost px-3 py-1.5 text-xs">{pick(locale, "Připojit se", "Pripojiť sa", "Join team")}</button>
                            </form>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {tm.entries.map((e) => (
                            <Link key={e.id} href={`/players/${e.user.handle}`} className="mr-2 hover:text-white">
                              {e.user.username}{e.userId === tm.captainId ? " ★" : ""}
                            </Link>
                          ))}
                        </p>
                        {open && iAmCaptain && spots > 0 && (
                          <form action={addTeamMember.bind(null, tm.id)} className="mt-2 flex gap-2">
                            <input name="handle" required placeholder="@handle" className="input py-1.5 text-xs" />
                            <button className="btn-ghost px-3 py-1.5 text-xs">{pick(locale, "Přidat hráče", "Pridať hráča", "Add player")}</button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                  {freeAgents.length > 0 && (
                    <p className="text-xs text-slate-500">
                      {pick(locale, "Bez týmu", "Bez tímu", "No team")}: {freeAgents.map((e) => e.user.username).join(", ")}
                    </p>
                  )}
                  {open && me && !myTeam && (
                    <details className="rounded-lg border border-dashed border-ink-600 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-accent-soft">
                        {pick(locale, "Přihlásit vlastní tým", "Prihlásiť vlastný tím", "Register your own team")}
                      </summary>
                      <form action={createTeam.bind(null, x.id)} className="mt-3 space-y-2">
                        <input name="teamName" required minLength={2} maxLength={40} placeholder={pick(locale, "Název týmu", "Názov tímu", "Team name")} className="input" />
                        <input
                          name="members"
                          placeholder={pick(locale, `@handly spoluhráčů (max ${x.teamSize - 1}), oddělené mezerou`, `@handly spoluhráčov (max ${x.teamSize - 1}), oddelené medzerou`, `Teammates' @handles (max ${x.teamSize - 1}), space separated`)}
                          className="input"
                        />
                        <p className="text-xs text-slate-500">
                          {pick(locale, "Ty jsi kapitán. Spoluhráče můžeš doplnit i později.", "Ty si kapitán. Spoluhráčov môžeš doplniť aj neskôr.", "You're the captain. You can add teammates later too.")}
                        </p>
                        <button className="btn">{pick(locale, "Přihlásit tým", "Prihlásiť tím", "Register team")}</button>
                      </form>
                    </details>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-600/60 px-5 py-3">
                <span className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                  {x.entries.length}/{x.maxPlayers} {t("players_short")}
                  <Link href={`/tournaments/${x.id}`} className="text-violet-300 hover:underline">{pick(locale, "Pavouk a výsledky", "Pavúk a výsledky", "Bracket & results")}</Link>
                  {isAdmin && x.status !== "CANCELLED" && x.status !== "FINISHED" && (
                    <form action={cancelTournament.bind(null, x.id)}>
                      <button className="text-xs text-slate-500 hover:text-ember">{pick(locale, "Zrušit turnaj", "Zrušiť turnaj", "Cancel")}</button>
                    </form>
                  )}
                  {isAdmin && (
                    <form action={deleteTournament.bind(null, x.id)}>
                      <button className="text-xs text-slate-500 hover:text-ember">{pick(locale, "Smazat", "Zmazať", "Delete")}</button>
                    </form>
                  )}
                </span>
                {open &&
                  (me ? (
                    joined ? (
                      <form action={leaveTournament.bind(null, x.id)}>
                        <button className="btn-ghost">{myTeam ? pick(locale, "Opustit tým a turnaj", "Opustiť tím a turnaj", "Leave team and tournament") : t("leave")}</button>
                      </form>
                    ) : full ? (
                      <span className="badge">{t("full")}</span>
                    ) : (
                      <form action={joinTournament.bind(null, x.id)}>
                        <button className="btn">{teamMode ? pick(locale, "Přihlásit se sólo", "Prihlásiť sa sólo", "Join solo") : t("join")}</button>
                      </form>
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
