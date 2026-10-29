import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getT, pick, type Locale } from "@/lib/i18n";
import { maybeSyncEsports } from "@/lib/esports";
import { settlePicks } from "@/lib/pickems";
import TeamMark from "@/components/TeamMark";
import { createEsportsMatch, deleteEsportsMatch, runEsportsSync, updateEsportsMatch } from "./actions";

export const metadata = { title: "Esport" };

const tag = (l: Locale) => (l === "cs" ? "cs-CZ" : l === "sk" ? "sk-SK" : "en-GB");
const dayKey = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(d);

type Match = {
  id: string; game: string; league: string; stage: string | null; startsAt: Date; bestOf: number;
  teamA: string; teamB: string; logoA: string | null; logoB: string | null;
  scoreA: number | null; scoreB: number | null; status: string; streamUrl: string | null; source: string;
};

export default async function EsportsPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; view?: string; error?: string; synced?: string; syncerr?: string }>;
}) {
  const sp = await searchParams;
  const { locale } = await getT();
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const game = sp.game === "lol" || sp.game === "valorant" ? sp.game : undefined;
  const results = sp.view === "results";

  await maybeSyncEsports();
  await settlePicks();

  const matches: Match[] = await db.esportsMatch.findMany({
    where: { ...(game ? { game } : {}), status: results ? "finished" : { in: ["upcoming", "live"] } },
    orderBy: { startsAt: results ? "desc" : "asc" },
    take: 80,
  });

  const today = dayKey(new Date());
  const tomorrow = dayKey(new Date(Date.now() + 86400000));
  const dayLabel = (d: Date) => {
    const k = dayKey(d);
    if (k === today) return pick(locale, "Dnes", "Dnes", "Today");
    if (k === tomorrow) return pick(locale, "Zítra", "Zajtra", "Tomorrow");
    return new Intl.DateTimeFormat(tag(locale), { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Prague" }).format(d);
  };
  const time = (d: Date) =>
    new Intl.DateTimeFormat(tag(locale), { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" }).format(d);

  const groups: { key: string; label: string; items: Match[] }[] = [];
  for (const m of matches) {
    const k = dayKey(m.startsAt);
    let g = groups.find((x) => x.key === k);
    if (!g) groups.push((g = { key: k, label: dayLabel(m.startsAt), items: [] }));
    g.items.push(m);
  }

  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ game: sp.game, view: sp.view, ...o })) if (v) p.set(k, v);
    const s = p.toString();
    return `/esports${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-8">
      <section className="stage stage-gold p-6 md:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl">Esport</h1>
            <p className="mt-3 max-w-xl text-slate-300">
              {pick(
                locale,
                "Rozpis a výsledky zápasů z LEC, Worlds, VCT a dalších lig. Časy jsou v pražském čase.",
                "Rozpis a výsledky zápasov z LEC, Worlds, VCT a ďalších líg. Časy sú v pražskom čase.",
                "Schedule and results from LEC, Worlds, VCT and more. Times are Prague time."
              )}
            </p>
          </div>
          {isAdmin && (
            <form action={runEsportsSync}>
              <button className="btn-ghost">{pick(locale, "Synchronizovat", "Synchronizovať", "Sync")}</button>
            </form>
          )}
        </div>
      </section>

      {sp.synced && (
        <p role="status" className="border border-pulse/40 bg-pulse/10 p-3 text-sm text-pulse">
          {pick(locale, `Uloženo zápasů: ${sp.synced}.`, `Uložených zápasov: ${sp.synced}.`, `Matches saved: ${sp.synced}.`)}
          {sp.syncerr && " " + pick(locale, "Některý zdroj neodpověděl.", "Niektorý zdroj neodpovedal.", "A source didn't respond.")}
        </p>
      )}
      {sp.error === "invalid" && (
        <p role="alert" className="border border-ember/40 bg-ember/10 p-3 text-sm text-ember">
          {pick(locale, "Zápas se nepodařilo uložit, zkontroluj vyplněná pole.", "Zápas sa nepodarilo uložiť, skontroluj vyplnené polia.", "Couldn't save the match, check the fields.")}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            [undefined, pick(locale, "Vše", "Všetko", "All")],
            ["lol", "League of Legends"],
            ["valorant", "VALORANT"],
          ].map(([k, label]) => (
            <Link key={label} href={q({ game: k })} aria-current={game === k} className="chip chip-gold">
              {label}
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          <Link href={q({ view: undefined })} aria-current={!results} className="chip chip-gold">
            {pick(locale, "Rozpis", "Rozpis", "Schedule")}
          </Link>
          <Link href={q({ view: "results" })} aria-current={results} className="chip chip-gold">
            {pick(locale, "Výsledky", "Výsledky", "Results")}
          </Link>
          <Link href="/pickems" className="chip chip-gold">Pickems</Link>
        </div>
      </div>

      {groups.length === 0 && (
        <p className="border border-dashed border-ink-600 p-8 text-center text-slate-400">
          {results
            ? pick(locale, "Zatím tu nejsou žádné výsledky.", "Zatiaľ tu nie sú žiadne výsledky.", "No results yet.")
            : pick(locale, "Žádné nadcházející zápasy. Admin je může přidat nebo synchronizovat.", "Žiadne nadchádzajúce zápasy. Admin ich môže pridať alebo synchronizovať.", "No upcoming matches. An admin can add or sync them.")}
        </p>
      )}

      {groups.map((g) => (
        <section key={g.key} className="space-y-3">
          <h2 className="text-xl capitalize text-gold">{g.label}</h2>
          <ul className="space-y-2">
            {g.items.map((m) => {
              const live = m.status === "live";
              const done = m.status === "finished";
              const winA = done && (m.scoreA ?? 0) > (m.scoreB ?? 0);
              const winB = done && (m.scoreB ?? 0) > (m.scoreA ?? 0);
              return (
                <li key={m.id} className="card">
                  <div className="grid items-center gap-3 p-4 md:grid-cols-[6rem_9rem_minmax(0,1fr)_auto]">
                    <div>
                      {live ? (
                        <p className="flex items-center gap-2 text-sm font-bold text-ember">
                          <span className="live-dot h-2 w-2 rounded-full bg-ember" aria-hidden="true" />
                          LIVE
                        </p>
                      ) : (
                        <p className="num text-2xl font-bold text-bone">{time(m.startsAt)}</p>
                      )}
                    </div>
                    <div className="text-sm">
                      <span className="badge badge-gold">{m.league}</span>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {[m.stage, m.bestOf > 1 ? `Bo${m.bestOf}` : null].filter(Boolean).join(", ")}
                      </p>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                      <div className={`flex items-center justify-end gap-3 text-right ${done && !winA ? "opacity-50" : ""}`}>
                        <span className="truncate font-display text-lg font-semibold text-bone">{m.teamA}</span>
                        <TeamMark name={m.teamA} logo={m.logoA} />
                      </div>
                      <div className="num min-w-16 text-center text-2xl font-bold">
                        {m.scoreA != null && m.scoreB != null ? (
                          <span className="text-white">
                            <span className={winA ? "text-gold" : ""}>{m.scoreA}</span>
                            <span className="px-1 text-slate-500">:</span>
                            <span className={winB ? "text-gold" : ""}>{m.scoreB}</span>
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-slate-500">vs</span>
                        )}
                      </div>
                      <div className={`flex items-center gap-3 ${done && !winB ? "opacity-50" : ""}`}>
                        <TeamMark name={m.teamB} logo={m.logoB} />
                        <span className="truncate font-display text-lg font-semibold text-bone">{m.teamB}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:justify-end">
                      <span className="badge">{m.game === "lol" ? "LoL" : "VALORANT"}</span>
                      {m.streamUrl && (
                        <a href={m.streamUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost !px-3 !py-1.5">
                          {pick(locale, "Sledovat", "Sledovať", "Watch")}
                        </a>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <details className="border-t border-ink-600/60 px-4 py-2 text-sm">
                      <summary className="cursor-pointer text-slate-400 hover:text-white">
                        {pick(locale, "Upravit", "Upraviť", "Edit")}
                      </summary>
                      <div className="flex flex-wrap items-end gap-4 py-3">
                        <form action={updateEsportsMatch.bind(null, m.id)} className="flex flex-wrap items-end gap-2">
                          <div><label className="label">{m.teamA}</label><input name="scoreA" type="number" min={0} max={9} defaultValue={m.scoreA ?? ""} className="input w-16" /></div>
                          <div><label className="label">{m.teamB}</label><input name="scoreB" type="number" min={0} max={9} defaultValue={m.scoreB ?? ""} className="input w-16" /></div>
                          <div>
                            <label className="label">Stav</label>
                            <select name="status" defaultValue={m.status} className="input">
                              <option value="upcoming">Nadcházející</option>
                              <option value="live">Živě</option>
                              <option value="finished">Dohráno</option>
                            </select>
                          </div>
                          <button className="btn">{pick(locale, "Uložit", "Uložiť", "Save")}</button>
                        </form>
                        <form action={deleteEsportsMatch.bind(null, m.id)}>
                          <button className="text-xs text-slate-500 hover:text-ember">{pick(locale, "Smazat", "Zmazať", "Delete")}</button>
                        </form>
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {isAdmin && (
        <details className="card p-5">
          <summary className="cursor-pointer font-display text-lg font-semibold text-gold">
            {pick(locale, "Přidat zápas", "Pridať zápas", "Add match")}
          </summary>
          <form action={createEsportsMatch} className="mt-4 grid gap-3 md:grid-cols-3">
            <div>
              <label className="label">Hra</label>
              <select name="game" className="input"><option value="lol">League of Legends</option><option value="valorant">VALORANT</option></select>
            </div>
            <div><label className="label">Liga</label><input name="league" required placeholder="LEC" maxLength={40} className="input" /></div>
            <div><label className="label">Fáze (nepovinné)</label><input name="stage" placeholder="Playoffs" maxLength={60} className="input" /></div>
            <div><label className="label">Začátek (pražský čas)</label><input name="startsAt" type="datetime-local" required className="input" /></div>
            <div>
              <label className="label">Formát</label>
              <select name="bestOf" defaultValue="3" className="input">
                <option value="1">Bo1</option><option value="3">Bo3</option><option value="5">Bo5</option>
              </select>
            </div>
            <div><label className="label">Odkaz na stream (nepovinné)</label><input name="streamUrl" type="url" maxLength={300} className="input" /></div>
            <div><label className="label">Tým A</label><input name="teamA" required maxLength={40} className="input" /></div>
            <div><label className="label">Tým B</label><input name="teamB" required maxLength={40} className="input" /></div>
            <div className="flex items-end"><button className="btn btn-gold">{pick(locale, "Přidat", "Pridať", "Add")}</button></div>
          </form>
        </details>
      )}
    </div>
  );
}
