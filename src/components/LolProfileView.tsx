import type { ReactNode } from "react";
import { PLATFORMS, type LolProfile, type RankEntry } from "@/lib/riot";
import { pick, type Locale } from "@/lib/i18n";
import RankTag from "./RankTag";

function ago(locale: Locale, ts: number) {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (m < 60) return pick(locale, `před ${m} min`, `pred ${m} min`, `${m} min ago`);
  const h = Math.round(m / 60);
  if (h < 48) return pick(locale, `před ${h} h`, `pred ${h} h`, `${h} h ago`);
  const d = Math.round(h / 24);
  return pick(locale, `před ${d} dny`, `pred ${d} dňami`, `${d} d ago`);
}

function Rank({ title, r, locale }: { title: string; r: RankEntry | null; locale: Locale }) {
  const total = r ? r.wins + r.losses : 0;
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-400">{title}</p>
      {r ? (
        <>
          <div className="mt-1 flex items-baseline justify-between">
            <RankTag tier={r.tier} sub={["MASTER", "GRANDMASTER", "CHALLENGER"].includes(r.tier) ? "" : r.division} />
            <span className="font-display text-xl font-bold text-bone">{r.lp} LP</span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {r.wins}W {r.losses}L, {total ? Math.round((r.wins / total) * 100) : 0} % {pick(locale, "výher", "výhier", "win rate")}
          </p>
        </>
      ) : (
        <p className="mt-2 text-slate-500">{pick(locale, "Bez ranku", "Bez ranku", "Unranked")}</p>
      )}
    </div>
  );
}

export default function LolProfileView({
  p, locale, actions, compact = false,
}: { p: LolProfile; locale: Locale; actions?: ReactNode; compact?: boolean }) {
  const played = p.matches.filter((m) => !m.remake);
  const wins = played.filter((m) => m.win).length;
  const k = played.reduce((a, m) => a + m.kills, 0);
  const d = played.reduce((a, m) => a + m.deaths, 0);
  const a = played.reduce((a, m) => a + m.assists, 0);
  const kda = d === 0 ? k + a : (k + a) / d;

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.iconUrl} alt="" className="h-20 w-20 rounded-2xl border border-ink-600" />
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ink-950 px-2 py-0.5 text-xs font-semibold text-bone ring-1 ring-ink-600">
            {p.level}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-3xl font-bold">
            {p.gameName}
            <span className="ml-1 text-xl font-medium text-slate-500">#{p.tagLine}</span>
          </h2>
          <p className="text-sm text-slate-400">League of Legends, {PLATFORMS[p.platform]?.label ?? p.platform}</p>
        </div>
        {actions}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Rank title="Ranked Solo/Duo" r={p.solo} locale={locale} />
        <Rank title="Ranked Flex" r={p.flex} locale={locale} />
      </div>

      {!compact && p.mastery.length > 0 && (
        <section>
          <h3 className="mb-2 text-lg font-semibold">{pick(locale, "Nejlepší šampioni", "Najlepší šampióni", "Top champions")}</h3>
          <div className="flex flex-wrap gap-3">
            {p.mastery.map((m) => (
              <div key={m.name} className="card flex items-center gap-3 p-3 pr-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.icon && <img src={m.icon} alt="" className="h-11 w-11 rounded-xl" />}
                <div>
                  <p className="text-sm font-semibold text-bone">{m.name}</p>
                  <p className="text-xs text-slate-400">M{m.level}, {Math.round(m.points / 1000)}k</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold">{pick(locale, "Poslední zápasy", "Posledné zápasy", "Recent matches")}</h3>
          {played.length > 0 && (
            <p className="text-sm text-slate-400">
              {wins}W {played.length - wins}L, KDA {kda.toFixed(2)}
            </p>
          )}
        </div>
        {p.matches.length === 0 ? (
          <p className="text-slate-500">{pick(locale, "Žádné nedávné zápasy.", "Žiadne nedávne zápasy.", "No recent matches.")}</p>
        ) : (
          <ul className="space-y-2">
            {(compact ? p.matches.slice(0, 5) : p.matches).map((m) => (
              <li
                key={m.id}
                className={`flex items-center gap-4 rounded-xl border-l-4 bg-ink-800 px-4 py-3 ${
                  m.remake ? "border-slate-500" : m.win ? "border-pulse" : "border-ember"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.championIcon} alt={m.champion} className="h-11 w-11 rounded-xl" />
                <div className="w-28 shrink-0">
                  <p className={`text-sm font-semibold ${m.remake ? "text-slate-400" : m.win ? "text-pulse" : "text-ember"}`}>
                    {m.remake ? "Remake" : m.win ? pick(locale, "Výhra", "Výhra", "Victory") : pick(locale, "Prohra", "Prehra", "Defeat")}
                  </p>
                  <p className="truncate text-xs text-slate-400">{m.queue}</p>
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-display text-lg font-bold text-bone">
                    {m.kills} / {m.deaths} / {m.assists}
                  </p>
                  <p className="text-xs text-slate-400">CS {m.cs}</p>
                </div>
                <div className="hidden text-right text-xs text-slate-400 sm:block">
                  <p>{m.minutes} min</p>
                  <p>{ago(locale, m.playedAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
