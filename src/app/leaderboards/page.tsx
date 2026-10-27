import Link from "next/link";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Žebříčky" };

export default async function Leaderboards({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  const { game: slug } = await searchParams;
  const { t } = await getT();
  const games = await db.game.findMany({ orderBy: { sortOrder: "asc" } });
  const current = games.find((g) => g.slug === slug) ?? games[0];
  const rows = current
    ? await db.playerStat.findMany({
        where: { gameId: current.id },
        orderBy: [{ points: "desc" }, { wins: "desc" }],
        take: 50,
        include: { user: true },
      })
    : [];

  return (
    <div>
      <h1 className="mb-5 text-4xl font-bold">{t("leaderboards")}</h1>
      <div className="mb-6 flex flex-wrap gap-2">
        {games.map((g) => (
          <Link
            key={g.id}
            href={`/leaderboards?game=${g.slug}`}
            className={g.id === current?.id ? "btn" : "btn-ghost"}
          >
            {g.name}
          </Link>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-600 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">{t("players")}</th>
              <th className="p-3 text-right">{t("points")}</th>
              <th className="p-3 text-right">{t("wins")}</th>
              <th className="p-3 text-right">{t("losses")}</th>
              <th className="p-3 text-right">{t("winrate")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-slate-500">{t("noData")}</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b border-ink-700/60 last:border-0">
                <td className="p-3 font-display text-lg text-slate-400">{i + 1}</td>
                <td className="p-3">
                  <Link href={`/players/${r.user.handle}`} className="flex items-center gap-3 hover:text-white">
                    {r.user.avatarUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.user.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
                    )}
                    <span className="font-medium text-white">{r.user.username}</span>
                  </Link>
                </td>
                <td className="p-3 text-right font-display text-lg text-white">{r.points}</td>
                <td className="p-3 text-right text-pulse">{r.wins}</td>
                <td className="p-3 text-right text-ember">{r.losses}</td>
                <td className="p-3 text-right">{r.matches ? Math.round((r.wins / r.matches) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
