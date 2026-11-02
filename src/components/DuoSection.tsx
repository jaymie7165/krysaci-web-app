import Link from "next/link";
import { getDuoStats } from "@/lib/duo";
import { pick, type Locale } from "@/lib/i18n";

const pct = (w: number, n: number) => (n ? Math.round((w / n) * 100) : 0);

/** "Kdo s kým vyhrává": výsledky her hráče se spoluhráči z komunity (ověřené Riot účty). */
export default async function DuoSection({ userId, locale, isMe }: { userId: string; locale: Locale; isMe: boolean }) {
  const { rows, games } = await getDuoStats(userId).catch(() => ({ rows: [], games: 0 }));
  const L = (cs: string, sk: string, en: string) => pick(locale, cs, sk, en);
  if (rows.length === 0 && !isMe) return null;

  const best = rows.filter((r) => r.together >= 3).sort((a, b) => pct(b.togetherWins, b.together) - pct(a.togetherWins, a.together) || b.together - a.together)[0];
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold">{L("Kdo s kým vyhrává", "Kto s kým víťazí", "Who wins with whom")}</h2>
      {rows.length === 0 ? (
        <p className="card p-4 text-sm text-slate-400">
          {L("Zatím tu nic není. Zahraj si LoL s někým z Play Haven (oba potřebujete ověřený Riot účet) a uvidíš, s kým ti to nejvíc vyhrává.", "Zatiaľ tu nič nie je. Zahraj si LoL s niekým z Play Haven (obaja potrebujete overený Riot účet) a uvidíš, s kým ti to najviac víťazí.", "Nothing here yet. Play LoL with someone from Play Haven (you both need a verified Riot account) and you'll see who you win with.")}
        </p>
      ) : (
        <>
          {best && (
            <div className="card flex items-center gap-4 border-accent/40 bg-accent/5 p-4">
              <span className="text-3xl">🤝</span>
              <p className="text-sm text-slate-300">
                {L("Nejlepší duo", "Najlepšie duo", "Best duo")}:{" "}
                <Link href={`/players/${best.handle}`} className="font-bold text-white hover:underline">{best.username}</Link>
                {" · "}
                <span className="font-semibold text-pulse">{pct(best.togetherWins, best.together)} %</span>{" "}
                {L("výher", "výhier", "win rate")} ({best.togetherWins}/{best.together} {L("her", "hier", "games")})
              </p>
            </div>
          )}
          <div className="card divide-y divide-ink-600/40">
            {rows.slice(0, 10).map((r) => (
              <div key={r.userId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.avatarUrl ? <img src={r.avatarUrl} alt="" className="h-9 w-9 rounded-full" loading="lazy" /> : <span className="h-9 w-9 rounded-full bg-ink-600" />}
                <Link href={`/players/${r.handle}`} className="min-w-0 flex-1 truncate font-semibold text-white hover:underline">{r.username}</Link>
                <p className="text-sm text-slate-300">
                  {r.together > 0 ? <>{L("spolu", "spolu", "together")}: <b className="text-white">{r.togetherWins}/{r.together}</b> <span className={pct(r.togetherWins, r.together) >= 50 ? "text-pulse" : "text-ember"}>({pct(r.togetherWins, r.together)} %)</span></> : <span className="text-slate-500">{L("spolu: -", "spolu: -", "together: -")}</span>}
                </p>
                <p className="text-sm text-slate-300">
                  {r.against > 0 ? <>{L("proti", "proti", "against")}: <b className="text-white">{r.againstWins}/{r.against}</b> <span className="text-slate-400">({pct(r.againstWins, r.against)} %)</span></> : <span className="text-slate-500">{L("proti: -", "proti: -", "against: -")}</span>}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">{L(`Z posledních ${games} her. Počítají se jen ověřené účty členů Play Haven.`, `Z posledných ${games} hier. Počítajú sa len overené účty členov Play Haven.`, `From the last ${games} games. Only verified accounts of Play Haven members count.`)}</p>
        </>
      )}
    </section>
  );
}
