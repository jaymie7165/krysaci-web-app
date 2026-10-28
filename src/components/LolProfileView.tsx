import Link from "next/link";
import type { ReactNode } from "react";
import { PLATFORMS, type DData, type LiveGame, type LolMatch, type LolProfile, type MatchPlayer, type RankEntry } from "@/lib/riot";
import { pick, type Locale } from "@/lib/i18n";
import RankTag from "./RankTag";

/* ---------- Pomocné funkce ---------- */

const CDN = "https://ddragon.leagueoflegends.com/cdn";
const champImg = (dd: DData, id: string) => (id ? `${CDN}/${dd.version}/img/champion/${id}.png` : "");
const itemImg = (dd: DData, id: number) => `${CDN}/${dd.version}/img/item/${id}.png`;
const spellImg = (dd: DData, id: number) => (dd.spells[String(id)] ? `${CDN}/${dd.version}/img/spell/${dd.spells[String(id)]}.png` : "");
const runeImg = (dd: DData, id: number) => (dd.runes[String(id)] ? `${CDN}/img/${dd.runes[String(id)]}` : "");

function ago(locale: Locale, ts: number) {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (m < 60) return pick(locale, `před ${m} min`, `pred ${m} min`, `${m} min ago`);
  const h = Math.round(m / 60);
  if (h < 48) return pick(locale, `před ${h} h`, `pred ${h} h`, `${h} h ago`);
  const d = Math.round(h / 24);
  return pick(locale, `před ${d} dny`, `pred ${d} dňami`, `${d} d ago`);
}

const kdaOf = (k: number, d: number, a: number) => (d === 0 ? k + a : (k + a) / d);
const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const ROLES: Record<string, [string, string, string]> = {
  TOP: ["Top", "Top", "Top"],
  JUNGLE: ["Jungle", "Jungle", "Jungle"],
  MIDDLE: ["Mid", "Mid", "Mid"],
  BOTTOM: ["ADC", "ADC", "ADC"],
  UTILITY: ["Support", "Support", "Support"],
};
const roleName = (locale: Locale, r: string) => (ROLES[r] ? pick(locale, ...ROLES[r]) : "");

const TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
const DIVS: Record<string, number> = { IV: 0, III: 1, II: 2, I: 3 };
/** Převod ranku na jedno číslo, aby šel nakreslit do grafu. */
function absLp(tier: string, division: string, lp: number) {
  const t = TIERS.indexOf(tier);
  if (t < 0) return 0;
  return t >= 7 ? 2800 + lp : t * 400 + (DIVS[division] ?? 0) * 100 + lp;
}
function labelAbs(v: number) {
  if (v >= 2800) return "Master+";
  const t = Math.floor(v / 400);
  const name = TIERS[t] ?? "";
  return name[0] + name.slice(1).toLowerCase();
}

/* ---------- Malé komponenty ---------- */

function Img({ src, alt = "", className = "" }: { src: string; alt?: string; className?: string }) {
  if (!src) return <span className={`block bg-ink-700 ${className}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={className} />;
}

function Items({ dd, items, size = "h-6 w-6" }: { dd: DData; items: number[]; size?: string }) {
  return (
    <span className="flex gap-0.5">
      {items.map((id, i) =>
        id ? <Img key={i} src={itemImg(dd, id)} className={`${size} rounded-[2px]`} /> : <span key={i} className={`${size} rounded-[2px] bg-ink-700`} />
      )}
    </span>
  );
}

function RankCard({ title, r, locale }: { title: string; r: RankEntry | null; locale: Locale }) {
  const total = r ? r.wins + r.losses : 0;
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-400">{title}</p>
      {r ? (
        <>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <RankTag tier={r.tier} sub={["MASTER", "GRANDMASTER", "CHALLENGER"].includes(r.tier) ? "" : r.division} />
            <span className="num text-xl text-bone">{r.lp} LP</span>
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

function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="text-xl font-semibold">{children}</h2>
      <span className="hud-line flex-1" aria-hidden="true" />
      {right}
    </div>
  );
}

/* ---------- Živá hra ---------- */

function LiveBanner({ live, p, locale }: { live: LiveGame; p: LolProfile; locale: Locale }) {
  const mins = Math.max(0, Math.floor((Date.now() - live.startedAt) / 60000));
  const teams = [100, 200].map((id) => live.players.filter((x) => x.teamId === id));
  return (
    <section className="panel panel-edge p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="live-dot" aria-hidden="true" />
        <h2 className="text-xl font-semibold">{pick(locale, "Právě hraje", "Práve hrá", "In game now")}</h2>
        <span className="badge">{live.queue}</span>
        <span className="text-sm text-slate-400">{mins} min</span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {teams.map((team, i) => (
          <ul key={i} className="space-y-1.5">
            {team.map((pl) => (
              <li
                key={pl.puuid}
                className={`flex items-center gap-2 rounded-[3px] px-2 py-1.5 ${pl.puuid === p.puuid ? "bg-accent/25" : "bg-ink-900/70"}`}
              >
                <Img src={champImg(p.dd, pl.champion)} className="h-8 w-8 rounded-[2px]" />
                <span className="flex flex-col">
                  <Img src={spellImg(p.dd, pl.spells[0])} className="h-4 w-4 rounded-[2px]" />
                  <Img src={spellImg(p.dd, pl.spells[1])} className="h-4 w-4 rounded-[2px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-bone">{pl.name}</span>
                  <span className="block truncate text-xs text-slate-400">{pl.championName}</span>
                </span>
                {pl.rank ? (
                  <span className="shrink-0 text-xs text-slate-300">
                    {pl.rank.tier[0] + pl.rank.tier.slice(1).toLowerCase()} {["MASTER", "GRANDMASTER", "CHALLENGER"].includes(pl.rank.tier) ? "" : pl.rank.division}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-slate-500">{pick(locale, "bez ranku", "bez ranku", "unranked")}</span>
                )}
              </li>
            ))}
          </ul>
        ))}
      </div>
      {live.bans.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          {pick(locale, "Bany", "Bany", "Bans")}:
          {live.bans.map((b, i) => (
            <Img key={i} src={champImg(p.dd, b.champion)} className="h-6 w-6 rounded-[2px] opacity-70" />
          ))}
        </p>
      )}
    </section>
  );
}

/* ---------- Graf vývoje ranku ---------- */

export type Snapshot = { takenAt: Date | string; tier: string; division: string; lp: number };

function RankChart({ history, locale }: { history: Snapshot[]; locale: Locale }) {
  if (history.length < 2) {
    return (
      <p className="card p-5 text-sm text-slate-400">
        {pick(
          locale,
          "Graf se začne kreslit, až bude uložený víc než jeden bod. Rank se ukládá při načtení profilu a z bota několikrát denně.",
          "Graf sa začne kresliť, keď bude uložený viac než jeden bod. Rank sa ukladá pri načítaní profilu a z bota niekoľkokrát denne.",
          "The chart starts drawing once more than one point is saved. Rank is saved whenever the profile loads and by the bot several times a day."
        )}
      </p>
    );
  }
  const pts = history.map((h) => ({ t: new Date(h.takenAt).getTime(), v: absLp(h.tier, h.division, h.lp), h }));
  const W = 640, H = 180, padL = 56, padR = 12, padT = 12, padB = 24;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
  const vs = pts.map((x) => x.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  lo = Math.floor((lo - 30) / 100) * 100;
  hi = Math.ceil((hi + 30) / 100) * 100;
  if (hi === lo) hi = lo + 100;
  const X = (t: number) => padL + ((t - t0) / Math.max(1, t1 - t0)) * (W - padL - padR);
  const Y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const line = pts.map((x, i) => `${i ? "L" : "M"}${X(x.t).toFixed(1)},${Y(x.v).toFixed(1)}`).join(" ");
  const area = `${line} L${X(t1).toFixed(1)},${H - padB} L${X(t0).toFixed(1)},${H - padB} Z`;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / 100) * 100; v <= hi; v += 100) ticks.push(v);
  const last = pts[pts.length - 1];
  const first = pts[0];
  const diff = last.v - first.v;
  const df = new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : locale === "sk" ? "sk-SK" : "en-GB", { day: "numeric", month: "numeric" });

  return (
    <div className="card p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={pick(locale, "Graf vývoje ranku", "Graf vývoja ranku", "Rank progress chart")}>
        <defs>
          <linearGradient id="lp-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} stroke="#332a5e" strokeWidth="1" strokeDasharray={v % 400 === 0 ? "0" : "3 4"} />
            <text x={padL - 8} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="#9b93c4">
              {v % 400 === 0 || v >= 2800 ? labelAbs(v) : ["IV", "III", "II", "I"][Math.floor((v % 400) / 100)]}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#lp-fill)" />
        <path d={line} fill="none" stroke="#b79cff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.length <= 60 && pts.map((x, i) => <circle key={i} cx={X(x.t)} cy={Y(x.v)} r="3" fill="#ece9f8" />)}
        <text x={padL} y={H - 6} fontSize="11" fill="#9b93c4">{df.format(new Date(t0))}</text>
        <text x={W - padR} y={H - 6} fontSize="11" fill="#9b93c4" textAnchor="end">{df.format(new Date(t1))}</text>
      </svg>
      <p className="mt-2 text-sm text-slate-400">
        {pick(locale, "Od prvního záznamu", "Od prvého záznamu", "Since first record")}:{" "}
        <span className={`num ${diff >= 0 ? "text-pulse" : "text-ember"}`}>{diff >= 0 ? "+" : ""}{diff} LP</span>
      </p>
    </div>
  );
}

/* ---------- Zápas s rozbalovacím detailem ---------- */

function MatchCard({ m, p, locale }: { m: LolMatch; p: LolProfile; locale: Locale }) {
  const me = m.me;
  const kda = kdaOf(me.kills, me.deaths, me.assists);
  const teams = [100, 200].map((id) => m.players.filter((x) => x.teamId === id));
  const maxDmg = Math.max(...m.players.map((x) => x.damage), 1);
  const tone = m.remake ? "border-slate-500" : m.win ? "border-pulse" : "border-ember";
  const label = m.remake ? pick(locale, "Remake", "Remake", "Remake") : m.win ? pick(locale, "Výhra", "Výhra", "Win") : pick(locale, "Prohra", "Prehra", "Loss");
  const teamKills = (id: number) => teams[id === 100 ? 0 : 1].reduce((a, x) => a + x.kills, 0);

  return (
    <details className={`group card border-l-4 ${tone}`}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 p-3 [&::-webkit-details-marker]:hidden">
        <div className="w-24 shrink-0">
          <p className={`font-display text-sm font-bold ${m.remake ? "text-slate-400" : m.win ? "text-pulse" : "text-ember"}`}>{label}</p>
          <p className="text-xs text-slate-400">{m.queue}</p>
          <p className="text-xs text-slate-500">{mmss(m.seconds)}, {ago(locale, m.playedAt)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Img src={champImg(p.dd, me.champion)} className="h-12 w-12 rounded-[3px]" />
            <span className="absolute -bottom-1 -right-1 rounded-[2px] bg-ink-950 px-1 text-[10px] text-bone">{me.champLevel}</span>
          </div>
          <span className="flex flex-col gap-0.5">
            <Img src={spellImg(p.dd, me.spells[0])} className="h-[23px] w-[23px] rounded-[2px]" />
            <Img src={spellImg(p.dd, me.spells[1])} className="h-[23px] w-[23px] rounded-[2px]" />
          </span>
          <span className="flex flex-col gap-0.5">
            <Img src={runeImg(p.dd, me.keystone)} className="h-[23px] w-[23px] rounded-full bg-ink-900" />
            <Img src={runeImg(p.dd, me.secondaryStyle)} className="h-[23px] w-[23px] rounded-full bg-ink-900 p-0.5" />
          </span>
        </div>
        <div className="w-28 shrink-0">
          <p className="num text-lg text-bone">
            {me.kills} / <span className="text-ember">{me.deaths}</span> / {me.assists}
          </p>
          <p className="text-xs text-slate-400">{kda.toFixed(2)} KDA</p>
        </div>
        <div className="hidden w-28 shrink-0 text-xs text-slate-400 sm:block">
          <p>{me.cs} CS ({(me.cs / Math.max(1, m.seconds / 60)).toFixed(1)}/min)</p>
          <p>{pick(locale, "Vision", "Vision", "Vision")} {me.vision}</p>
          {me.multikill >= 2 && <p className="text-accent-soft">{["", "", "Double", "Triple", "Quadra", "Penta"][Math.min(me.multikill, 5)]} kill</p>}
        </div>
        <div className="ml-auto">
          <Items dd={p.dd} items={me.items} />
        </div>
        <span className="text-slate-500 transition group-open:rotate-180" aria-hidden="true">▾</span>
      </summary>

      <div className="space-y-4 border-t border-ink-600/60 p-3">
        {teams.map((team, ti) => {
          const id = ti === 0 ? 100 : 200;
          const won = team[0]?.win;
          return (
            <div key={id}>
              <p className={`mb-1.5 text-xs font-semibold ${won ? "text-pulse" : "text-ember"}`}>
                {won ? pick(locale, "Vítězný tým", "Víťazný tím", "Winning team") : pick(locale, "Poražený tým", "Porazený tím", "Losing team")}
                <span className="ml-2 font-normal text-slate-400">{teamKills(id)} {pick(locale, "killů", "killov", "kills")}</span>
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <tbody>
                    {team.map((x: MatchPlayer) => {
                      const mine = x.puuid === p.puuid;
                      const [gn, tl] = x.name.split("#");
                      return (
                        <tr key={x.puuid} className={mine ? "bg-accent/20" : ""}>
                          <td className="py-1 pl-1 pr-2">
                            <span className="flex items-center gap-2">
                              <Img src={champImg(p.dd, x.champion)} className="h-7 w-7 rounded-[2px]" />
                              <span className="flex flex-col">
                                <Img src={spellImg(p.dd, x.spells[0])} className="h-3.5 w-3.5 rounded-[1px]" />
                                <Img src={spellImg(p.dd, x.spells[1])} className="h-3.5 w-3.5 rounded-[1px]" />
                              </span>
                              <span className="min-w-0">
                                {tl ? (
                                  <Link
                                    href={`/lol/${p.platform}/${encodeURIComponent(gn)}-${encodeURIComponent(tl)}`}
                                    className="block max-w-[10rem] truncate font-medium text-bone hover:text-accent-soft"
                                  >
                                    {gn}
                                  </Link>
                                ) : (
                                  <span className="block max-w-[10rem] truncate font-medium text-bone">{x.name}</span>
                                )}
                                <span className="block text-[11px] text-slate-500">{roleName(locale, x.role)}</span>
                              </span>
                            </span>
                          </td>
                          <td className="px-2 text-right num text-bone">
                            {x.kills}/<span className="text-ember">{x.deaths}</span>/{x.assists}
                          </td>
                          <td className="hidden px-2 text-right text-xs text-slate-400 md:table-cell">{kdaOf(x.kills, x.deaths, x.assists).toFixed(1)}</td>
                          <td className="px-2">
                            <span className="flex items-center gap-2">
                              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-700" title={`${x.damage}`}>
                                <span className="block h-full bg-accent" style={{ width: `${Math.round((x.damage / maxDmg) * 100)}%` }} />
                              </span>
                              <span className="text-xs text-slate-300">{fmt(x.damage)}</span>
                            </span>
                          </td>
                          <td className="hidden px-2 text-right text-xs text-slate-400 sm:table-cell">{x.cs} CS</td>
                          <td className="hidden px-2 text-right text-xs text-slate-400 sm:table-cell">{fmt(x.gold)}</td>
                          <td className="hidden px-2 text-right text-xs text-slate-400 md:table-cell">{x.vision}</td>
                          <td className="py-1 pl-2 pr-1">
                            <Items dd={p.dd} items={x.items} size="h-5 w-5" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        <p className="text-[11px] text-slate-500">
          {pick(locale, "Sloupce: K/D/A, damage šampionům, CS, gold, vision, itemy.", "Stĺpce: K/D/A, damage šampiónom, CS, gold, vision, itemy.", "Columns: K/D/A, damage to champions, CS, gold, vision, items.")}
        </p>
      </div>
    </details>
  );
}

/* ---------- Hlavní zobrazení ---------- */

export default function LolProfileView({
  p, locale, actions, compact = false, history = [], live = null, gamesParam,
}: {
  p: LolProfile;
  locale: Locale;
  actions?: ReactNode;
  compact?: boolean;
  history?: Snapshot[];
  live?: LiveGame | null;
  /** Základ adresy pro přepínač 20 / 50 zápasů (např. "/lol/eun1/Jaymie-HNZD"). */
  gamesParam?: string;
}) {
  const played = p.matches.filter((m) => !m.remake);
  const wins = played.filter((m) => m.win).length;
  const k = played.reduce((a, m) => a + m.me.kills, 0);
  const d = played.reduce((a, m) => a + m.me.deaths, 0);
  const a = played.reduce((acc, m) => acc + m.me.assists, 0);
  const mins = played.reduce((acc, m) => acc + m.seconds / 60, 0);
  const cs = played.reduce((acc, m) => acc + m.me.cs, 0);

  // Šampioni
  const byChamp = new Map<string, { id: string; games: number; wins: number; k: number; d: number; a: number; cs: number; mins: number }>();
  for (const m of played) {
    const c = byChamp.get(m.me.champion) ?? { id: m.me.champion, games: 0, wins: 0, k: 0, d: 0, a: 0, cs: 0, mins: 0 };
    c.games++; if (m.win) c.wins++; c.k += m.me.kills; c.d += m.me.deaths; c.a += m.me.assists; c.cs += m.me.cs; c.mins += m.seconds / 60;
    byChamp.set(m.me.champion, c);
  }
  const champs = [...byChamp.values()].sort((x, y) => y.games - x.games || y.wins - x.wins).slice(0, 6);
  const champName = (id: string) => Object.values(p.dd.champs).find((c) => c.id === id)?.name ?? id;

  // Role
  const byRole = new Map<string, { games: number; wins: number }>();
  for (const m of played) {
    if (!m.me.role) continue;
    const r = byRole.get(m.me.role) ?? { games: 0, wins: 0 };
    r.games++; if (m.win) r.wins++;
    byRole.set(m.me.role, r);
  }
  const roles = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"].map((r) => ({ r, ...(byRole.get(r) ?? { games: 0, wins: 0 }) }));
  const roleTotal = roles.reduce((s, x) => s + x.games, 0);

  const shown = compact ? p.matches.slice(0, 5) : p.matches;

  return (
    <div className="space-y-8">
      {/* Hlavička */}
      <section className="panel panel-edge flex flex-wrap items-center gap-5 p-5">
        <div className="relative">
          <Img src={`${CDN}/${p.dd.version}/img/profileicon/${p.iconId}.png`} className="h-20 w-20 rounded-[3px] border border-ink-600" />
          <span className="num absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-[3px] bg-ink-950 px-2 py-0.5 text-xs text-bone ring-1 ring-ink-600">{p.level}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-3xl font-bold">
            {p.gameName}
            <span className="ml-1 text-xl font-medium text-slate-500">#{p.tagLine}</span>
          </h2>
          <p className="text-sm text-slate-400">{PLATFORMS[p.platform]?.label ?? p.platform}, {pick(locale, "úroveň", "úroveň", "level")} {p.level}</p>
        </div>
        {actions}
      </section>

      {live && !compact && <LiveBanner live={live} p={p} locale={locale} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <RankCard title="Ranked Solo/Duo" r={p.solo} locale={locale} />
        <RankCard title="Ranked Flex" r={p.flex} locale={locale} />
      </div>

      {/* Přehled posledních her */}
      {played.length > 0 && (
        <section>
          <SectionTitle
            right={
              !compact && gamesParam ? (
                <span className="flex gap-1 text-sm">
                  {[20, 50].map((n) => (
                    <Link
                      key={n}
                      href={n === 20 ? gamesParam : `${gamesParam}?games=${n}`}
                      className={`rounded-[3px] px-2.5 py-1 ${p.requested === n ? "bg-accent text-white" : "bg-ink-800 text-slate-300 hover:text-white"}`}
                    >
                      {n}
                    </Link>
                  ))}
                </span>
              ) : undefined
            }
          >
            {pick(locale, `Posledních ${played.length} her`, `Posledných ${played.length} hier`, `Last ${played.length} games`)}
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              [`${Math.round((wins / played.length) * 100)} %`, `${wins}W ${played.length - wins}L`, pick(locale, "Výhry", "Výhry", "Win rate")],
              [kdaOf(k, d, a).toFixed(2), `${(k / played.length).toFixed(1)} / ${(d / played.length).toFixed(1)} / ${(a / played.length).toFixed(1)}`, "KDA"],
              [(cs / Math.max(1, mins)).toFixed(1), `${Math.round(cs / played.length)} CS`, pick(locale, "CS za minutu", "CS za minútu", "CS per min")],
              [String(Math.round(mins / played.length)), "min", pick(locale, "Průměrná hra", "Priemerná hra", "Avg game")],
            ].map(([big, small, label]) => (
              <div key={label} className="card p-4">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="num text-3xl text-bone">{big}</p>
                <p className="text-xs text-slate-400">{small}</p>
              </div>
            ))}
          </div>
          {p.partial && (
            <p className="mt-2 text-xs text-ember">
              {pick(locale, "Část zápasů se nepodařilo načíst (limit Riotu). Zkus to za chvíli znovu, načtené zápasy se uložily.", "Časť zápasov sa nepodarilo načítať (limit Riotu). Skús to o chvíľu znova, načítané zápasy sa uložili.", "Some matches couldn't be loaded (Riot rate limit). Try again shortly, loaded matches are saved.")}
            </p>
          )}
        </section>
      )}

      {/* Šampioni a role */}
      {!compact && champs.length > 0 && (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div>
            <SectionTitle>{pick(locale, "Šampioni", "Šampióni", "Champions")}</SectionTitle>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="p-3 font-medium">{pick(locale, "Šampion", "Šampión", "Champion")}</th>
                    <th className="p-3 text-right font-medium">{pick(locale, "Hry", "Hry", "Games")}</th>
                    <th className="p-3 text-right font-medium">{pick(locale, "Výhry", "Výhry", "Win rate")}</th>
                    <th className="p-3 text-right font-medium">KDA</th>
                    <th className="p-3 text-right font-medium">CS/min</th>
                  </tr>
                </thead>
                <tbody>
                  {champs.map((c) => {
                    const wr = Math.round((c.wins / c.games) * 100);
                    return (
                      <tr key={c.id} className="border-t border-ink-600/50">
                        <td className="p-3">
                          <span className="flex items-center gap-2">
                            <Img src={champImg(p.dd, c.id)} className="h-8 w-8 rounded-[2px]" />
                            <span className="font-medium text-bone">{champName(c.id)}</span>
                          </span>
                        </td>
                        <td className="p-3 text-right num text-bone">{c.games}</td>
                        <td className="p-3 text-right">
                          <span className={`num ${wr >= 50 ? "text-pulse" : "text-ember"}`}>{wr} %</span>
                          <span className="ml-1 text-xs text-slate-500">{c.wins}W {c.games - c.wins}L</span>
                        </td>
                        <td className="p-3 text-right num text-bone">{kdaOf(c.k, c.d, c.a).toFixed(2)}</td>
                        <td className="p-3 text-right text-slate-300">{(c.cs / Math.max(1, c.mins)).toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <SectionTitle>{pick(locale, "Role", "Role", "Roles")}</SectionTitle>
            <div className="card space-y-3 p-4">
              {roleTotal === 0 && <p className="text-sm text-slate-500">{pick(locale, "Role nejsou k dispozici.", "Role nie sú k dispozícii.", "No role data.")}</p>}
              {roles.filter((x) => x.games > 0).sort((x, y) => y.games - x.games).map((x) => (
                <div key={x.r}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium text-bone">{roleName(locale, x.r)}</span>
                    <span className="text-xs text-slate-400">
                      {x.games} {pick(locale, "her", "hier", "games")}, {Math.round((x.wins / x.games) * 100)} %
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
                    <div className="h-full bg-accent" style={{ width: `${Math.round((x.games / roleTotal) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Vývoj ranku */}
      {!compact && (
        <section>
          <SectionTitle>{pick(locale, "Vývoj ranku (Solo/Duo)", "Vývoj ranku (Solo/Duo)", "Rank progress (Solo/Duo)")}</SectionTitle>
          <RankChart history={history} locale={locale} />
        </section>
      )}

      {/* Mastery */}
      {!compact && p.mastery.length > 0 && (
        <section>
          <SectionTitle>{pick(locale, "Nejvíc mastery bodů", "Najviac mastery bodov", "Top mastery")}</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {p.mastery.map((m) => (
              <div key={m.championId} className="card flex flex-col items-center p-3 text-center">
                <Img src={champImg(p.dd, m.champion)} className="h-14 w-14 rounded-[3px]" />
                <p className="mt-2 text-sm font-medium text-bone">{m.name}</p>
                <p className="text-xs text-slate-400">M{m.level}</p>
                <p className="num text-sm text-accent-soft">{fmt(m.points)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Zápasy */}
      <section>
        <SectionTitle>{pick(locale, "Zápasy", "Zápasy", "Matches")}</SectionTitle>
        {shown.length === 0 ? (
          <p className="card p-5 text-slate-400">{pick(locale, "Žádné ranked ani normal zápasy k zobrazení.", "Žiadne ranked ani normal zápasy na zobrazenie.", "No ranked or normal matches to show.")}</p>
        ) : (
          <div className="space-y-2">
            {shown.map((m) => (
              <MatchCard key={m.id} m={m} p={p} locale={locale} />
            ))}
          </div>
        )}
        {!compact && (
          <p className="mt-3 text-xs text-slate-500">
            {pick(
              locale,
              "Vlastní hry (customky) se bez souhlasu hráče nezobrazují.",
              "Vlastné hry (customky) sa bez súhlasu hráča nezobrazujú.",
              "Custom games aren't shown without the player's consent."
            )}
          </p>
        )}
      </section>
    </div>
  );
}
