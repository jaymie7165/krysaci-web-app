import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getT, dateFmt, pick } from "@/lib/i18n";
import { sendFriendRequest, updateProfile, saveGameProfile } from "@/app/actions";
import GameSelect from "@/components/GameSelect";
import LinkedAccountsSection from "@/components/LinkedAccountsSection";
import ShareCard from "@/components/ShareCard";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const p = await db.user.findUnique({ where: { handle }, select: { username: true, bio: true } }).catch(() => null);
  if (!p) return { title: "Hráč" };
  return {
    title: p.username,
    description: p.bio || `Vizitka hráče ${p.username} na Play Haven.`,
    openGraph: { title: `${p.username} na Play Haven`, description: p.bio || "Vizitka hráče, statistiky a propojené herní účty." },
  };
}

export default async function PlayerPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const { t, locale } = await getT();
  const session = await auth();
  const player = await db.user.findUnique({
    where: { handle },
    include: {
      gameProfiles: { include: { game: true } },
      stats: { include: { game: true } },
    },
  });
  if (!player) notFound();

  const isMe = session?.user?.id === player.id;
  const games = isMe ? await db.game.findMany({ orderBy: { sortOrder: "asc" } }) : [];
  const friendship =
    session?.user && !isMe
      ? await db.friendship.findFirst({
          where: {
            OR: [
              { requesterId: session.user.id, addresseeId: player.id },
              { requesterId: player.id, addresseeId: session.user.id },
            ],
          },
        })
      : null;

  return (
    <div className="space-y-8">
      <section className="card overflow-hidden">
        <div className="h-28" style={{ background: `linear-gradient(120deg, ${player.accent}, #0d0a1a)` }} />
        <div className="flex flex-wrap items-end gap-5 px-6 pb-6">
          {player.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.avatarUrl} alt="" className="-mt-12 h-24 w-24 rounded-full border-4 border-ink-800" />
          ) : (
            <div className="-mt-12 h-24 w-24 rounded-full border-4 border-ink-800 bg-ink-600" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold">{player.username}</h1>
            <p className="text-sm text-slate-500">
              @{player.handle} · {t("memberSince")} {dateFmt(locale, player.createdAt).split(",")[0]}
              {player.role !== "USER" && <span className="badge ml-2">{player.role}</span>}
            </p>
            {player.bio && <p className="mt-2 max-w-xl text-slate-300">{player.bio}</p>}
          </div>
          {session?.user && !isMe && !friendship && (
            <form action={sendFriendRequest.bind(null, player.id)}>
              <button className="btn">{t("addFriend")}</button>
            </form>
          )}
          {friendship?.status === "PENDING" && <span className="badge">{t("pending")}</span>}
          {friendship?.status === "ACCEPTED" && <span className="badge">{pick(locale, "Přátelé", "Priatelia", "Friends")}</span>}
        </div>
        <div className="border-t border-ink-600/60 px-6 py-3">
          <ShareCard
            handle={player.handle}
            labels={{
              copy: pick(locale, "Kopírovat odkaz na vizitku", "Kopírovať odkaz na vizitku", "Copy card link"),
              copied: pick(locale, "Zkopírováno", "Skopírované", "Copied"),
              share: pick(locale, "Sdílet", "Zdieľať", "Share"),
              image: pick(locale, "Obrázek vizitky", "Obrázok vizitky", "Card image"),
            }}
          />
        </div>
      </section>

      <LinkedAccountsSection userId={player.id} locale={locale} isMe={isMe} />

      <section>
        <h2 className="mb-3 text-2xl font-semibold">{t("stats")}</h2>
        {player.stats.length === 0 && <p className="text-slate-500">{t("noData")}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {player.stats.map((s) => (
            <div key={s.id} className="card p-4">
              <h3 className="text-lg font-semibold">{s.game.name}</h3>
              <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
                <div><dt className="text-slate-500">{t("points")}</dt><dd className="font-display text-xl text-white">{s.points}</dd></div>
                <div><dt className="text-slate-500">{t("wins")}</dt><dd className="font-display text-xl text-pulse">{s.wins}</dd></div>
                <div><dt className="text-slate-500">{t("losses")}</dt><dd className="font-display text-xl text-ember">{s.losses}</dd></div>
                <div><dt className="text-slate-500">WR</dt><dd className="font-display text-xl text-white">{s.matches ? Math.round((s.wins / s.matches) * 100) : 0}%</dd></div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-semibold">{t("gameProfiles")}</h2>
        {player.gameProfiles.length === 0 && <p className="text-slate-500">{t("noData")}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {player.gameProfiles.map((gp) => (
            <div key={gp.id} className="card flex items-center gap-3 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gp.game.imageUrl} alt="" className="h-12 w-20 rounded object-cover" />
              <div>
                <p className="font-semibold text-white">{gp.inGameName}</p>
                <p className="text-xs text-slate-400">{gp.game.name}{gp.rank ? ` · ${gp.rank}` : ""}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {isMe && (
        <div className="grid gap-6 md:grid-cols-2">
          <form action={updateProfile} className="card space-y-3 p-5">
            <div>
              <label className="label">{t("bio")}</label>
              <textarea name="bio" defaultValue={player.bio ?? ""} maxLength={400} rows={3} className="input" />
            </div>
            <div>
              <label className="label">{t("accent")}</label>
              <input type="color" name="accent" defaultValue={player.accent} className="h-10 w-20 cursor-pointer rounded bg-transparent" />
            </div>
            <button className="btn">{t("save")}</button>
          </form>
          <form action={saveGameProfile} className="card space-y-3 p-5">
            <div>
              <label className="label">{t("game")}</label>
              <GameSelect games={games} />
            </div>
            <div>
              <label className="label">{t("inGameName")}</label>
              <input name="inGameName" required maxLength={40} className="input" />
            </div>
            <div>
              <label className="label">{t("rank")}</label>
              <input name="rank" maxLength={30} className="input" />
            </div>
            <button className="btn">{t("save")}</button>
          </form>
        </div>
      )}
    </div>
  );
}
