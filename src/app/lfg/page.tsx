import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getT, pick } from "@/lib/i18n";
import { addToLfg, createLfg, joinLfg, closeLfg, leaveLfg } from "@/app/actions";
import Notice from "@/components/Notice";
import GameSelect from "@/components/GameSelect";

export const metadata = { title: "LFG" };

export default async function LfgPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { t, locale } = await getT();
  const session = await auth();
  const [posts, games] = await Promise.all([
    db.lfgPost.findMany({
      where: { open: true },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { game: true, author: true, joins: { include: { user: true } } },
    }),
    session?.user ? db.game.findMany({ orderBy: { sortOrder: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">{t("lfg")}</h1>
      <Notice msg={msg} locale={locale} />

      {session?.user ? (
        <form action={createLfg} className="card grid gap-3 p-5 md:grid-cols-2">
          <div><label className="label">{t("game")}</label><GameSelect games={games} /></div>
          <div><label className="label">{t("title")}</label><input name="title" required minLength={3} maxLength={80} className="input" /></div>
          <div><label className="label">{t("slots")}</label><input type="number" name="slots" defaultValue={5} min={1} max={20} className="input" /></div>
          <div><label className="label">{t("rank")}</label><input name="rankHint" maxLength={30} className="input" /></div>
          <div className="md:col-span-2"><label className="label">{t("description")}</label><textarea name="description" rows={2} maxLength={500} className="input" /></div>
          <div><button className="btn">{t("create")}</button></div>
        </form>
      ) : (
        <p className="text-slate-400">{t("loginRequired")}</p>
      )}

      {posts.length === 0 && <p className="text-slate-500">{t("noData")}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {posts.map((p) => {
          const taken = p.joins.length + 1;
          const joined = !!session?.user && p.joins.some((j) => j.userId === session.user.id);
          const mine = session?.user?.id === p.authorId;
          const canClose = mine || (!!session?.user && session.user.role !== "USER");
          return (
            <article key={p.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">{p.title}</h3>
                  <p className="text-sm text-slate-400">
                    {p.game.name}
                    {p.rankHint ? ` · ${p.rankHint}` : ""} ·{" "}
                    <Link href={`/players/${p.author.handle}`} className="hover:text-white">{p.author.username}</Link>
                  </p>
                </div>
                <span className="badge">{taken}/{p.slots}</span>
              </div>
              {p.description && <p className="mt-2 text-sm text-slate-300">{p.description}</p>}
              {p.joins.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">{p.joins.map((j) => j.user.username).join(", ")}</p>
              )}
              {canClose && taken < p.slots && (
                <form action={addToLfg.bind(null, p.id)} className="mt-3 flex gap-2">
                  <input name="handle" required placeholder={pick(locale, "Přidat hráče: @handle", "Pridať hráča: @handle", "Add player: @handle")} className="input py-1.5 text-xs" />
                  <button className="btn-ghost px-3 py-1.5 text-xs">+</button>
                </form>
              )}
              <div className="mt-4 flex gap-2">
                {session?.user && !mine && !joined && taken < p.slots && (
                  <form action={joinLfg.bind(null, p.id)}><button className="btn">{t("join")}</button></form>
                )}
                {joined && (
                  <form action={leaveLfg.bind(null, p.id)}><button className="btn-ghost">{t("leave")}</button></form>
                )}
                {taken >= p.slots && <span className="badge">{t("full")}</span>}
                {canClose && (
                  <form action={closeLfg.bind(null, p.id)}><button className="btn-ghost">{t("closeLfg")}</button></form>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
