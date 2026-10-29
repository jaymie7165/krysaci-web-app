import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getT, pick } from "@/lib/i18n";

export const metadata = { title: "Žebříčky" };

export default async function Leaderboards({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  const { game: slug } = await searchParams;
  const { t, locale } = await getT();
  const session = await auth();
  const me = session?.user?.id;
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
  const podium = rows.slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">{t("leaderboards")}</h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          {pick(
            locale,
            "Pořadí hráčů v jednotlivých hrách podle bodů z komunitních zápasů (customky a turnaje na našem Discordu). Body, výhry a prohry sem posílá náš bot po každém odehraném zápase. Vybranou hru přepneš tlačítky níž.",
            "Poradie hráčov v jednotlivých hrách podľa bodov z komunitných zápasov (customky a turnaje na našom Discorde). Body, výhry a prehry sem posiela náš bot po každom odohranom zápase. Vybranú hru prepneš tlačidlami nižšie.",
            "Player ranking per game by points from community matches (customs and tournaments on our Discord). Our bot sends points, wins and losses here after each played match. Switch games with the buttons below."
          )}
        </p>
        <p className="mt-2 text-sm text-slate-400">
          {pick(locale, "Tipuješ esport? Žebříček tipů najdeš v ", "Tipuješ esport? Rebríček tipov nájdeš v ", "Into esports predictions? The picks leaderboard is in ")}
          <Link href="/pickems?view=board" className="text-accent-soft hover:text-white">Pickems</Link>.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {games.map((g) => (
          <Link key={g.id} href={`/leaderboards?game=${g.slug}`} className={g.id === current?.id ? "btn" : "btn-ghost"}>
            {g.name}
          </Link>
        ))}
      </div>

      {podium.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {podium.map((r, i) => (
            <Link
              key={r.id}
              href={`/players/${r.user.handle}`}
              className={`card flex items-center gap-4 p-4 transition hover:border-accent ${i === 0 ? "sm:order-2" : i === 1 ? "sm:order-1" : "sm:order-3"}`}
            >
              <span className={`num text-4xl ${i === 0 ? "text-gold" : "text-slate-400"}`}>{i + 1}</span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-white">{r.user.username}</span>
                <span className="num block text-xl text-accent-soft">{r.points} {pick(locale, "b.", "b.", "pts")}</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-600 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">{t("players")}</th>
              <th className="p-3 text-right">{t("points")}</th>
              <th className="p-3 text-right">{pick(locale, "Zápasů", "Zápasov", "Matches")}</th>
              <th className="p-3 text-right">{t("wins")}</th>
              <th className="p-3 text-right">{t("losses")}</th>
              <th className="p-3 text-right">{t("winrate")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400">
                  {pick(
                    locale,
                    "V téhle hře zatím nejsou žádné body. Objeví se po prvních odehraných komunitních zápasech.",
                    "V tejto hre zatiaľ nie sú žiadne body. Objavia sa po prvých odohraných komunitných zápasoch.",
                    "No points in this game yet. They appear after the first community matches."
                  )}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.id} className={`border-b border-ink-700/60 last:border-0 ${r.userId === me ? "bg-accent/10" : ""}`}>
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
                <td className="num p-3 text-right text-lg text-white">{r.points}</td>
                <td className="p-3 text-right text-slate-300">{r.matches}</td>
                <td className="p-3 text-right text-pulse">{r.wins}</td>
                <td className="p-3 text-right text-ember">{r.losses}</td>
                <td className="p-3 text-right">{r.matches ? Math.round((r.wins / r.matches) * 100) : 0} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
