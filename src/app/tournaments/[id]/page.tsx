import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, pick, dateFmt } from "@/lib/i18n";
import { roundName, roundsFor, usersOf } from "@/lib/bracket";
import { startTournament, reportResult, reviewResult } from "../actions";
import Notice from "@/components/Notice";

export const metadata = { title: "Pavouk turnaje" };

export default async function BracketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  const { id } = await params;
  const { msg } = await searchParams;
  const { locale } = await getT();
  const L = (cs: string, sk: string, en: string) => pick(locale, cs, sk, en);
  const session = await auth();
  const me = session?.user;
  const t = await db.tournament.findUnique({
    where: { id },
    include: { game: true, entries: true, teams: { include: { entries: true } }, matches: { orderBy: [{ round: "asc" }, { position: "asc" }] } },
  });
  if (!t) notFound();
  const canManage = !!me && (me.role === "ADMIN" || t.organizerId === me.id);
  const rounds = t.matches.length ? roundsFor(t.matches.filter((m) => m.round === 1).length * 2).rounds : 0;
  const byRound = Array.from({ length: rounds }, (_, i) => t.matches.filter((m) => m.round === i + 1));
  const participants = t.teamSize > 1 ? t.teams.length : t.entries.length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/tournaments" className="text-sm text-violet-300 hover:underline">← {L("Turnaje", "Turnaje", "Tournaments")}</Link>
        <h1 className="text-3xl font-bold">{t.name}</h1>
        <p className="text-sm text-slate-400">{t.game.name} · {dateFmt(locale, t.startsAt)} · {participants} {L("účastníků", "účastníkov", "participants")}</p>
      </div>
      <Notice msg={msg} locale={locale} />
      {t.championName && (
        <p className="card border-gold/40 p-4 text-lg font-semibold">🏆 {L("Vítěz", "Víťaz", "Champion")}: {t.championName}</p>
      )}
      {t.matches.length === 0 && (
        <div className="card space-y-3 p-5">
          <p className="text-slate-300">{L("Pavouk se vylosuje po spuštění turnaje.", "Pavúk sa vylosuje po spustení turnaja.", "The bracket is drawn when the tournament starts.")}</p>
          {canManage && t.status === "UPCOMING" && (
            <form action={startTournament.bind(null, t.id)}>
              <button className="btn">{L("Spustit turnaj a vylosovat pavouk", "Spustiť turnaj a vylosovať pavúk", "Start tournament and draw bracket")}</button>
            </form>
          )}
        </div>
      )}
      <div className="flex gap-6 overflow-x-auto pb-4">
        {byRound.map((ms, ri) => (
          <section key={ri} className="flex min-w-60 flex-col justify-around gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{roundName(ri + 1, rounds, locale)}</h2>
            {ms.map((m) => {
              const mine = !!me && [...usersOf(t, m.refA), ...usersOf(t, m.refB)].includes(me.id);
              const ready = !!m.refA && !!m.refB && m.status !== "confirmed";
              const row = (name: string | null, score: number | null, win: boolean) => (
                <div className={`flex items-center justify-between gap-2 px-3 py-1.5 text-sm ${win ? "font-semibold text-white" : "text-slate-300"}`}>
                  <span className="truncate">{name ?? <span className="text-slate-600">—</span>}</span>
                  <span className="num">{score ?? ""}</span>
                </div>
              );
              return (
                <div key={m.id} className={`card overflow-hidden ${mine ? "ring-1 ring-violet-500" : ""}`}>
                  {row(m.nameA, m.scoreA, m.winner === "A")}
                  <div className="border-t border-ink-600/50" />
                  {row(m.nameB, m.scoreB, m.winner === "B")}
                  {m.status === "reported" && (
                    <div className="space-y-1 border-t border-ink-600/50 px-3 py-2 text-xs text-gold">
                      {L("Čeká na potvrzení", "Čaká na potvrdenie", "Awaiting confirmation")}
                      {canManage && (
                        <div className="flex gap-2">
                          <form action={reviewResult.bind(null, m.id)}><input type="hidden" name="decision" value="ok" /><button className="text-pulse hover:underline">{L("Potvrdit", "Potvrdiť", "Confirm")}</button></form>
                          <form action={reviewResult.bind(null, m.id)}><input type="hidden" name="decision" value="reject" /><button className="text-ember hover:underline">{L("Vrátit", "Vrátiť", "Reject")}</button></form>
                        </div>
                      )}
                    </div>
                  )}
                  {ready && m.status !== "reported" && (mine || canManage) && t.status === "LIVE" && (
                    <form action={reportResult.bind(null, m.id)} className="flex items-center gap-1 border-t border-ink-600/50 p-2">
                      <input name="scoreA" type="number" min={0} max={99} required aria-label="A" className="input w-14 py-1 text-xs" />
                      <span className="text-slate-500">:</span>
                      <input name="scoreB" type="number" min={0} max={99} required aria-label="B" className="input w-14 py-1 text-xs" />
                      <button className="btn-ghost px-2 py-1 text-xs">{canManage ? L("Zapsat", "Zapísať", "Set") : L("Nahlásit", "Nahlásiť", "Report")}</button>
                    </form>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
      {t.matches.length > 0 && (
        <p className="text-xs text-slate-500">
          {L(
            "Výsledek nahlásí hráč ze zápasu, platí po potvrzení pořadatelem. Body: 10 za výhru, 5 za účast, 25 finalista, 50 vítěz.",
            "Výsledok nahlási hráč zo zápasu, platí po potvrdení organizátorom. Body: 10 za výhru, 5 za účasť, 25 finalista, 50 víťaz.",
            "A player in the match reports the score; it counts once the organizer confirms. Points: 10 per win, 5 participation, 25 finalist, 50 champion."
          )}
        </p>
      )}
    </div>
  );
}
