import Link from "next/link";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Hráči" };

export default async function PlayersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { t } = await getT();
  const players = await db.user.findMany({
    where: q
      ? {
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { handle: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { lastSeenAt: "desc" },
    take: 60,
    include: { gameProfiles: { include: { game: true }, take: 3 } },
  });

  return (
    <div>
      <h1 className="mb-4 text-4xl font-bold">{t("players")}</h1>
      <form className="mb-6 max-w-md">
        <input name="q" defaultValue={q} placeholder={t("searchPlayers")} className="input" />
      </form>
      {players.length === 0 && <p className="text-slate-500">{t("noData")}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p) => (
          <Link
            key={p.id}
            href={`/players/${p.handle}`}
            className="card flex items-center gap-4 border-l-4 p-4 transition hover:shadow-glow"
            style={{ borderLeftColor: p.accent }}
          >
            {p.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.avatarUrl} alt="" className="h-14 w-14 rounded-full" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-ink-600" />
            )}
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold">{p.username}</h3>
              <p className="truncate text-sm text-slate-500">@{p.handle}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {p.gameProfiles.map((gp) => (
                  <span key={gp.id} className="badge">{gp.game.name}</span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
