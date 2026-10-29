import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getT, pick, type Locale } from "@/lib/i18n";
import { maybeSyncEsports } from "@/lib/esports";
import { POINTS, UNDERDOG_MIN_PICKS, UNDERDOG_SHARE, seriesResults, settlePicks, stageMultiplier } from "@/lib/pickems";
import TeamMark from "@/components/TeamMark";
import Notice from "@/components/Notice";
import { removePick, savePick } from "./actions";

export const metadata = { title: "Pickems" };

const tag = (l: Locale) => (l === "cs" ? "cs-CZ" : l === "sk" ? "sk-SK" : "en-GB");

export default async function PickemsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; league?: string; scope?: string; msg?: string }>;
}) {
  const sp = await searchParams;
  const { locale } = await getT();
  const session = await auth();
  const me = session?.user;
  const view = sp.view === "board" || sp.view === "mine" ? sp.view : "tips";

  await maybeSyncEsports();
  await settlePicks();

  const dt = new Intl.DateTimeFormat(tag(locale), { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });
  const tabs: [string, string][] = [
    ["tips", pick(locale, "Tipy", "Tipy", "Picks")],
    ["board", pick(locale, "Žebříček", "Rebríček", "Leaderboard")],
    ["mine", pick(locale, "Moje tipy", "Moje tipy", "My picks")],
  ];

  return (
    <div className="space-y-8">
      <section className="stage stage-gold p-6 md:p-10">
        <h1 className="text-4xl md:text-5xl">Pickems</h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          {pick(
            locale,
            "Tipni výsledky zápasů z LEC, Worlds, VCT a dalších lig dřív, než začnou. Za správné tipy sbíráš body a stoupáš v žebříčku komunity.",
            "Tipni výsledky zápasov z LEC, Worlds, VCT a ďalších líg skôr, než začnú. Za správne tipy zbieraš body a stúpaš v rebríčku komunity.",
            "Predict match results from LEC, Worlds, VCT and more before they start. Correct picks earn points and climb the community leaderboard."
          )}
        </p>
        <details className="mt-4 max-w-2xl text-sm text-slate-300">
          <summary className="cursor-pointer font-semibold text-gold">{pick(locale, "Jak se počítají body", "Ako sa počítajú body", "How points work")}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>{pick(locale, `Správný vítěz zápasu: ${POINTS.winner} bodů.`, `Správny víťaz zápasu: ${POINTS.winner} bodov.`, `Correct winner: ${POINTS.winner} points.`)}</li>
            <li>{pick(locale, `Přesný výsledek série (Bo3, Bo5), třeba 2:1: +${POINTS.exact} bodů.`, `Presný výsledok série (Bo3, Bo5), napríklad 2:1: +${POINTS.exact} bodov.`, `Exact series score (Bo3, Bo5), e.g. 2:1: +${POINTS.exact} points.`)}</li>
            <li>{pick(locale, `Outsider: trefíš vítěze, kterého tipovalo méně než ${UNDERDOG_SHARE * 100} % hráčů (od ${UNDERDOG_MIN_PICKS} tipů): +${POINTS.underdog} bodů.`, `Outsider: trafíš víťaza, ktorého tipovalo menej ako ${UNDERDOG_SHARE * 100} % hráčov (od ${UNDERDOG_MIN_PICKS} tipov): +${POINTS.underdog} bodov.`, `Underdog: you call a winner that fewer than ${UNDERDOG_SHARE * 100}% of players picked (from ${UNDERDOG_MIN_PICKS} picks): +${POINTS.underdog} points.`)}</li>
            <li>{pick(locale, "Důležitost fáze: playoff a semifinále ×1,5, finále ×2.", "Dôležitosť fázy: playoff a semifinále ×1,5, finále ×2.", "Stage weight: playoffs and semifinals ×1.5, finals ×2.")}</li>
            <li>{pick(locale, "Tip jde měnit do začátku zápasu. Body se přidělí, jakmile je zápas dohraný.", "Tip ide meniť do začiatku zápasu. Body sa pridelia, keď je zápas dohraný.", "You can change a pick until the match starts. Points are awarded once the match is finished.")}</li>
          </ul>
        </details>
      </section>

      <Notice msg={sp.msg} locale={locale} />

      <div className="flex gap-2">
        {tabs.map(([k, label]) => (
          <Link key={k} href={k === "tips" ? "/pickems" : `/pickems?view=${k}`} aria-current={view === k} className="chip chip-gold">
            {label}
          </Link>
        ))}
      </div>

      {view === "tips" && <Tips locale={locale} meId={me?.id} dt={dt} />}
      {view === "board" && <Board locale={locale} meId={me?.id} league={sp.league} friendsOnly={sp.scope === "friends"} />}
      {view === "mine" && <Mine locale={locale} meId={me?.id} dt={dt} />}
    </div>
  );
}

/* ---------- Tipy na nadcházející zápasy ---------- */
async function Tips({ locale, meId, dt }: { locale: Locale; meId?: string; dt: Intl.DateTimeFormat }) {
  const matches = await db.esportsMatch.findMany({
    where: { status: { in: ["upcoming", "live"] }, startsAt: { lte: new Date(Date.now() + 14 * 86400000) } },
    orderBy: { startsAt: "asc" },
    take: 40,
    include: { picks: { select: { userId: true, winner: true, scoreA: true, scoreB: true } } },
  });
  if (matches.length === 0)
    return (
      <p className="border border-dashed border-ink-600 p-8 text-center text-slate-400">
        {pick(locale, "Žádné zápasy k tipování. Nové se objeví, jakmile je admin přidá nebo se načtou z lig.", "Žiadne zápasy na tipovanie. Nové sa objavia, keď ich admin pridá alebo sa načítajú z líg.", "No matches to pick. New ones appear when an admin adds them or they sync from the leagues.")}
      </p>
    );
  return (
    <ul className="space-y-3">
      {matches.map((m) => {
        const mine = m.picks.find((p) => p.userId === meId);
        const locked = m.status !== "upcoming" || m.startsAt.getTime() <= Date.now();
        const a = m.picks.filter((p) => p.winner === "A").length;
        const total = m.picks.length;
        const pctA = total ? Math.round((a / total) * 100) : 50;
        const showCrowd = total > 0 && (!!mine || locked);
        const mult = stageMultiplier(m.stage);
        const results = m.bestOf > 1 ? seriesResults(m.bestOf) : null;
        return (
          <li key={m.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span>
                <span className="badge badge-gold mr-2">{m.league}</span>
                {[m.stage, m.bestOf > 1 ? `Bo${m.bestOf}` : null].filter(Boolean).join(", ")}
                {mult > 1 && <span className="ml-2 text-gold">×{String(mult).replace(".", ",")}</span>}
              </span>
              <span>
                {m.status === "live" ? <span className="font-bold text-ember">LIVE</span> : dt.format(m.startsAt)}
                {locked && <span className="ml-2 badge">{pick(locale, "Uzamčeno", "Uzamknuté", "Locked")}</span>}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
              <div className="flex items-center justify-end gap-3 text-right">
                <span className="truncate font-display text-lg font-semibold text-bone">{m.teamA}</span>
                <TeamMark name={m.teamA} logo={m.logoA} />
              </div>
              <span className="text-sm text-slate-500">vs</span>
              <div className="flex items-center gap-3">
                <TeamMark name={m.teamB} logo={m.logoB} />
                <span className="truncate font-display text-lg font-semibold text-bone">{m.teamB}</span>
              </div>
            </div>

            {showCrowd && (
              <div className="mt-3">
                <div className="flex h-1.5 overflow-hidden rounded-full bg-ink-700">
                  <div className="bg-accent" style={{ width: `${pctA}%` }} />
                  <div className="bg-gold" style={{ width: `${100 - pctA}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                  <span>{pctA} %</span>
                  <span>{total} {pick(locale, "tipů", "tipov", "picks")}</span>
                  <span>{100 - pctA} %</span>
                </div>
              </div>
            )}

            <div className="mt-3">
              {!meId ? (
                <p className="text-sm text-slate-400">{pick(locale, "Pro tipování se přihlas přes Discord.", "Na tipovanie sa prihlás cez Discord.", "Sign in with Discord to pick.")}</p>
              ) : locked ? (
                <p className="text-sm text-slate-400">
                  {mine
                    ? pick(locale, "Tvůj tip", "Tvoj tip", "Your pick") + `: ${mine.winner === "A" ? m.teamA : m.teamB}${mine.scoreA != null ? ` ${mine.scoreA}:${mine.scoreB}` : ""}`
                    : pick(locale, "Na tenhle zápas jsi netipoval.", "Na tento zápas si netipoval.", "You didn't pick this match.")}
                </p>
              ) : (
                <form action={savePick.bind(null, m.id)} className="flex flex-wrap items-center gap-2">
                  {(results ?? [{ winner: "A" as const, a: 0, b: 0 }, { winner: "B" as const, a: 0, b: 0 }]).map((r) => {
                    const value = results ? `${r.winner}:${r.a}:${r.b}` : r.winner;
                    const active = mine && mine.winner === r.winner && (!results || (mine.scoreA === r.a && mine.scoreB === r.b));
                    const label = results ? `${r.winner === "A" ? m.teamA : m.teamB} ${r.a}:${r.b}` : r.winner === "A" ? m.teamA : m.teamB;
                    return (
                      <button
                        key={value}
                        name="pick"
                        value={value}
                        aria-pressed={!!active}
                        className={`chip ${active ? "!border-accent !bg-accent/30 !text-white" : ""}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  {mine && (
                    <button formAction={removePick.bind(null, m.id)} className="text-xs text-slate-500 hover:text-ember">
                      {pick(locale, "Smazat tip", "Zmazať tip", "Clear pick")}
                    </button>
                  )}
                </form>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Žebříček ---------- */
async function Board({ locale, meId, league, friendsOnly }: { locale: Locale; meId?: string; league?: string; friendsOnly: boolean }) {
  const leagues = (await db.esportsMatch.findMany({ where: { picks: { some: {} } }, distinct: ["league"], select: { league: true } })).map((x) => x.league);
  const matchWhere = league && leagues.includes(league) ? { league } : {};

  let userFilter: { userId?: { in: string[] } } = {};
  if (friendsOnly && meId) {
    const fr = await db.friendship.findMany({ where: { status: "ACCEPTED", OR: [{ requesterId: meId }, { addresseeId: meId }] } });
    userFilter = { userId: { in: [meId, ...fr.map((f) => (f.requesterId === meId ? f.addresseeId : f.requesterId))] } };
  }
  const where = { points: { not: null }, match: matchWhere, ...userFilter };
  const [sums, correct] = await Promise.all([
    db.pick.groupBy({ by: ["userId"], where, _sum: { points: true }, _count: { _all: true }, orderBy: { _sum: { points: "desc" } }, take: 50 }),
    db.pick.groupBy({ by: ["userId"], where: { ...where, points: { gt: 0 } }, _count: { _all: true } }),
  ]);
  const users = await db.user.findMany({ where: { id: { in: sums.map((s) => s.userId) } } });
  const uMap = new Map(users.map((u) => [u.id, u]));
  const okMap = new Map(correct.map((c) => [c.userId, c._count._all]));
  const href = (o: { league?: string; scope?: string }) => {
    const p = new URLSearchParams({ view: "board" });
    const l = "league" in o ? o.league : league;
    const sc = "scope" in o ? o.scope : friendsOnly ? "friends" : undefined;
    if (l) p.set("league", l);
    if (sc) p.set("scope", sc);
    return `/pickems?${p}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={href({ league: undefined })} aria-current={!league} className="chip chip-gold">{pick(locale, "Vše", "Všetko", "All")}</Link>
        {leagues.map((l) => (
          <Link key={l} href={href({ league: l })} aria-current={league === l} className="chip chip-gold">{l}</Link>
        ))}
        {meId && (
          <span className="ml-auto flex gap-2">
            <Link href={href({ scope: undefined })} aria-current={!friendsOnly} className="chip">{pick(locale, "Všichni", "Všetci", "Everyone")}</Link>
            <Link href={href({ scope: "friends" })} aria-current={friendsOnly} className="chip">{pick(locale, "Přátelé", "Priatelia", "Friends")}</Link>
          </span>
        )}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-600 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">{pick(locale, "Hráč", "Hráč", "Player")}</th>
              <th className="p-3 text-right">{pick(locale, "Body", "Body", "Points")}</th>
              <th className="p-3 text-right">{pick(locale, "Trefeno", "Trafené", "Correct")}</th>
              <th className="p-3 text-right">{pick(locale, "Úspěšnost", "Úspešnosť", "Accuracy")}</th>
            </tr>
          </thead>
          <tbody>
            {sums.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-slate-500">{pick(locale, "Zatím žádné vyhodnocené tipy.", "Zatiaľ žiadne vyhodnotené tipy.", "No scored picks yet.")}</td></tr>
            )}
            {sums.map((s, i) => {
              const u = uMap.get(s.userId);
              if (!u) return null;
              const total = s._count._all;
              const ok = okMap.get(s.userId) ?? 0;
              return (
                <tr key={s.userId} className={`border-b border-ink-700/60 last:border-0 ${s.userId === meId ? "bg-accent/10" : ""}`}>
                  <td className="p-3 font-display text-lg text-slate-400">{i + 1}</td>
                  <td className="p-3">
                    <Link href={`/players/${u.handle}`} className="flex items-center gap-3 hover:text-white">
                      {u.avatarUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
                      )}
                      <span className="font-medium text-white">{u.username}</span>
                    </Link>
                  </td>
                  <td className="num p-3 text-right text-lg text-white">{s._sum.points ?? 0}</td>
                  <td className="p-3 text-right text-slate-300">{ok}/{total}</td>
                  <td className="p-3 text-right text-slate-300">{total ? Math.round((ok / total) * 100) : 0} %</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Moje tipy ---------- */
async function Mine({ locale, meId, dt }: { locale: Locale; meId?: string; dt: Intl.DateTimeFormat }) {
  if (!meId) return <p className="text-slate-400">{pick(locale, "Přihlas se přes Discord, ať vidíš své tipy.", "Prihlás sa cez Discord, nech vidíš svoje tipy.", "Sign in with Discord to see your picks.")}</p>;
  const picks = await db.pick.findMany({ where: { userId: meId }, include: { match: true }, orderBy: { match: { startsAt: "desc" } }, take: 60 });
  const total = picks.reduce((s, p) => s + (p.points ?? 0), 0);
  if (picks.length === 0) return <p className="card p-5 text-slate-400">{pick(locale, "Zatím jsi nic netipoval. Otevři záložku Tipy.", "Zatiaľ si nič netipoval. Otvor záložku Tipy.", "No picks yet. Open the Picks tab.")}</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        {pick(locale, "Body celkem", "Body spolu", "Total points")}: <span className="num text-xl text-white">{total}</span>
      </p>
      <ul className="space-y-2">
        {picks.map((p) => {
          const m = p.match;
          const done = p.points != null;
          return (
            <li key={p.id} className="card flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-white">{m.teamA} vs {m.teamB}</p>
                <p className="text-xs text-slate-400">{m.league} · {dt.format(m.startsAt)}</p>
              </div>
              <p className="text-slate-300">
                {pick(locale, "Tip", "Tip", "Pick")}: <span className="text-white">{p.winner === "A" ? m.teamA : m.teamB}{p.scoreA != null ? ` ${p.scoreA}:${p.scoreB}` : ""}</span>
              </p>
              <p className="w-28 text-right">
                {done ? (
                  <span className={`num text-lg ${p.points! > 0 ? "text-pulse" : "text-ember"}`}>{p.points! > 0 ? `+${p.points}` : "0"} b.</span>
                ) : (
                  <span className="text-xs text-slate-500">{pick(locale, "čeká na výsledek", "čaká na výsledok", "pending")}</span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
