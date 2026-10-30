import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { getT, dateFmt, pick, type Key } from "@/lib/i18n";
import { addToCustom, cancelCustom, createCustom, joinCustom, leaveCustom } from "@/app/actions";
import Notice from "@/components/Notice";
import GameSelect from "@/components/GameSelect";

export const metadata = { title: "Customky" };

export default async function CustomsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { t, locale } = await getT();
  const session = await auth();
  const [items, games] = await Promise.all([
    db.custom.findMany({
      where: { status: { in: ["UPCOMING", "LIVE"] } },
      orderBy: { startsAt: "asc" },
      include: { game: true, host: true, entries: { include: { user: true } } },
    }),
    session?.user ? db.game.findMany({ orderBy: { sortOrder: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">{t("customs")}</h1>
      <p className="text-sm text-slate-400">
        <a href="/api/calendar" className="text-violet-300 hover:underline">{pick(locale, "Přidat do kalendáře (.ics)", "Pridať do kalendára (.ics)", "Add to calendar (.ics)")}</a>
        {" · "}
        <a href="/api/calendar?mine=1" className="text-violet-300 hover:underline">{pick(locale, "jen moje", "len moje", "only mine")}</a>
      </p>
      <Notice msg={msg} locale={locale} />

      {session?.user ? (
        <form action={createCustom} className="card grid gap-3 p-5 md:grid-cols-2">
          <div><label className="label">{t("game")}</label><GameSelect games={games} /></div>
          <div><label className="label">{t("title")}</label><input name="title" required minLength={3} maxLength={80} className="input" /></div>
          <div><label className="label">{t("date")}</label><input type="datetime-local" name="startsAt" required className="input" /></div>
          <div><label className="label">{t("maxPlayers")}</label><input type="number" name="maxPlayers" defaultValue={10} min={2} max={100} className="input" /></div>
          <div className="md:col-span-2"><label className="label">{t("description")}</label><textarea name="description" rows={2} maxLength={500} className="input" /></div>
          <div><button className="btn">{t("create")}</button></div>
        </form>
      ) : (
        <p className="text-slate-400">{t("loginRequired")}</p>
      )}

      {items.length === 0 && <p className="text-slate-500">{t("noData")}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((x) => {
          const joined = !!session?.user && x.entries.some((e) => e.userId === session.user.id);
          const full = x.entries.length >= x.maxPlayers;
          const mine = !!session?.user && (x.hostId === session.user.id || session.user.role === "ADMIN");
          return (
            <article key={x.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">{x.title}</h3>
                  <p className="text-sm text-slate-400">{x.game.name} · {dateFmt(locale, x.startsAt)}</p>
                </div>
                <span className="badge">{t(`status_${x.status}` as Key)}</span>
              </div>
              {x.description && <p className="mt-2 text-sm text-slate-300">{x.description}</p>}
              <p className="mt-2 text-xs text-slate-500">
                {x.entries.map((e) => (
                  <Link key={e.id} href={`/players/${e.user.handle}`} className="mr-2 hover:text-white">{e.user.username}</Link>
                ))}
              </p>
              {mine && !full && (
                <form action={addToCustom.bind(null, x.id)} className="mt-3 flex gap-2">
                  <input name="handle" required placeholder={pick(locale, "Přidat hráče: @handle", "Pridať hráča: @handle", "Add player: @handle")} className="input py-1.5 text-xs" />
                  <button className="btn-ghost px-3 py-1.5 text-xs">+</button>
                </form>
              )}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-slate-400">{t("host")}: {x.host.username} · {x.entries.length}/{x.maxPlayers}</span>
                <span className="flex items-center gap-2">
                {mine && (
                  <form action={cancelCustom.bind(null, x.id)}>
                    <button className="text-xs text-slate-500 hover:text-ember">{pick(locale, "Zrušit customku", "Zrušiť customku", "Cancel")}</button>
                  </form>
                )}
                {session?.user &&
                  (joined ? (
                    <form action={leaveCustom.bind(null, x.id)}><button className="btn-ghost">{t("leave")}</button></form>
                  ) : full ? (
                    <span className="badge">{t("full")}</span>
                  ) : (
                    <form action={joinCustom.bind(null, x.id)}><button className="btn">{t("join")}</button></form>
                  ))}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
