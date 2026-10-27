import { db } from "@/lib/db";
import { getT } from "@/lib/i18n";
import GameCard from "@/components/GameCard";

export const metadata = { title: "Hry" };

export default async function GamesPage() {
  const { t } = await getT();
  const games = await db.game.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div>
      <h1 className="text-4xl font-bold">{t("games")}</h1>
      <p className="mt-2 mb-8 text-slate-400">{t("gamesIntro")}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </div>
    </div>
  );
}
