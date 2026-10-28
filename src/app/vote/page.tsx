import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { deleteSuggestion, suggestGame, toggleVote } from "@/app/actions";

export const metadata = { title: "Hlasování o hrách" };

export default async function VotePage() {
  const { t } = await getT();
  const session = await auth();
  const items = await db.gameSuggestion.findMany({
    include: { proposer: true, votes: { select: { userId: true } } },
  });
  items.sort((a, b) => b.votes.length - a.votes.length);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">{t("vote")}</h1>
        <p className="mt-2 text-slate-400">{t("gamesIntro")}</p>
      </div>

      {session?.user?.role === "ADMIN" ? (
        <form action={suggestGame} className="card grid gap-3 p-5 md:grid-cols-2">
          <div><label className="label">{t("gameName")}</label><input name="name" required minLength={2} maxLength={60} className="input" /></div>
          <div><label className="label">{t("storeUrl")}</label><input name="storeUrl" type="url" maxLength={300} className="input" /></div>
          <div className="md:col-span-2"><label className="label">{t("reason")}</label><textarea name="reason" rows={2} maxLength={300} className="input" /></div>
          <div><button className="btn">{t("suggestGame")}</button></div>
        </form>
      ) : !session?.user ? (
        <p className="text-slate-400">{t("loginRequired")}</p>
      ) : null}

      {items.length === 0 && <p className="text-slate-500">{t("noData")}</p>}
      <div className="space-y-3">
        {items.map((s) => {
          const voted = !!session?.user && s.votes.some((v) => v.userId === session.user.id);
          return (
            <div key={s.id} className="card flex items-center gap-4 p-4">
              <div className="w-16 text-center">
                <p className="font-display text-3xl font-bold text-white">{s.votes.length}</p>
                <p className="text-xs text-slate-500">{t("votes")}</p>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold">
                  {s.storeUrl ? (
                    <a href={s.storeUrl} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-accent-soft">
                      {s.name}
                    </a>
                  ) : (
                    s.name
                  )}
                </h3>
                {s.reason && <p className="text-sm text-slate-400">{s.reason}</p>}
                <p className="text-xs text-slate-500">{s.proposer.username}</p>
              </div>
              {session?.user?.role === "ADMIN" && (
                <form action={deleteSuggestion.bind(null, s.id)}>
                  <button className="text-xs text-slate-500 hover:text-ember">Smazat</button>
                </form>
              )}
              {session?.user && (
                <form action={toggleVote.bind(null, s.id)}>
                  <button className={voted ? "btn-ghost" : "btn"}>{voted ? t("unvote") : t("voteBtn")}</button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
