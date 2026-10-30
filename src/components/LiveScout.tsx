import Link from "next/link";
import { ddragon, getScoutAll, type DData, type LiveGame, type LivePlayer, type LolProfile, type Scout } from "@/lib/riot";
import { pick, type Locale } from "@/lib/i18n";
import { advice, comp } from "@/lib/scoutAdvice";

const CDN = "https://ddragon.leagueoflegends.com/cdn";

function Img({ src, className = "", title }: { src: string; className?: string; title?: string }) {
  if (!src) return <span className={`block bg-ink-700 ${className}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" title={title} loading="lazy" className={className} />;
}

const champ = (dd: DData, id: string) => (id ? `${CDN}/${dd.version}/img/champion/${id}.png` : "");
const item = (dd: DData, id: number) => `${CDN}/${dd.version}/img/item/${id}.png`;
const rune = (dd: DData, id: number) => (dd.runes[String(id)] ? `${CDN}/img/${dd.runes[String(id)]}` : "");
const rankText = (r: LivePlayer["rank"]) =>
  r ? `${r.tier[0] + r.tier.slice(1).toLowerCase()}${["MASTER", "GRANDMASTER", "CHALLENGER"].includes(r.tier) ? "" : " " + r.division}` : "";

/* ---------- Tvůj build na šampionovi ---------- */

function myBuild(p: LolProfile, championId: string) {
  const games = p.matches.filter((m) => !m.remake && m.me.champion === championId);
  if (games.length === 0) return null;
  const count = <T,>(xs: T[]) => {
    const m = new Map<T, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const wins = games.filter((g) => g.win).length;
  const keystone = count(games.map((g) => g.me.keystone).filter(Boolean))[0]?.[0] ?? 0;
  const secondary = count(games.map((g) => g.me.secondaryStyle).filter(Boolean))[0]?.[0] ?? 0;
  const items = count(games.flatMap((g) => g.me.items.slice(0, 6)).filter(Boolean)).slice(0, 6).map((x) => x[0]);
  return { games: games.length, wins, keystone, secondary, items };
}

/* ---------- Hlavní komponenta ---------- */

export default async function LiveScout({ live, p, locale }: { live: LiveGame; p: LolProfile; locale: Locale }) {
  const dd = await ddragon();
  const mineTeam = live.players.find((x) => x.puuid === p.puuid)?.teamId ?? 100;
  const mine = live.players.filter((x) => x.teamId === mineTeam);
  const enemy = live.players.filter((x) => x.teamId !== mineTeam);
  const myChamp = live.players.find((x) => x.puuid === p.puuid);

  const scouts = await getScoutAll([...mine, ...enemy].map((x) => x.puuid), p.platform).catch(() => new Map<string, Scout>());
  const tips = advice(comp(mine, dd), comp(enemy, dd), locale);
  const build = myChamp ? myBuild(p, myChamp.champion) : null;

  const Team = ({ title, players }: { title: string; players: LivePlayer[] }) => (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <ul className="space-y-1.5">
        {players.map((pl) => {
          const s = scouts.get(pl.puuid);
          const wins = s?.recent.filter((r) => r.win).length ?? 0;
          const [gn, tl] = pl.name.split("#");
          return (
            <li key={pl.puuid} className={`rounded-[3px] p-2 ${pl.puuid === p.puuid ? "bg-accent/20" : "bg-ink-900/70"}`}>
              <div className="flex items-center gap-2">
                <Img src={champ(dd, pl.champion)} className="h-9 w-9 shrink-0 rounded-[2px]" />
                <div className="min-w-0 flex-1">
                  {tl ? (
                    <Link href={`/lol/${p.platform}/${encodeURIComponent(gn)}-${encodeURIComponent(tl)}`} className="block truncate text-sm font-medium text-bone hover:text-accent-soft">
                      {gn}
                    </Link>
                  ) : (
                    <span className="block truncate text-sm font-medium text-bone">{pl.name}</span>
                  )}
                  <span className="block text-xs text-slate-400">
                    {pl.championName}
                    {pl.rank ? `, ${rankText(pl.rank)} ${pl.rank.lp} LP, ${Math.round((pl.rank.wins / Math.max(1, pl.rank.wins + pl.rank.losses)) * 100)} % WR` : `, ${pick(locale, "bez ranku", "bez ranku", "unranked")}`}
                  </span>
                </div>
              </div>
              {s ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1" title={pick(locale, "Posledních 5 ranked solo/duo her", "Posledných 5 ranked solo/duo hier", "Last 5 ranked solo/duo games")}>
                    {s.recent.length === 0 && <span className="text-xs text-slate-500">{pick(locale, "žádné ranked solo hry", "žiadne ranked solo hry", "no ranked solo games")}</span>}
                    {s.recent.map((r) => (
                      <span
                        key={r.id}
                        title={`${r.champion}: ${r.kills}/${r.deaths}/${r.assists}`}
                        className={`relative inline-block ${r.win ? "ring-1 ring-pulse" : "ring-1 ring-ember"} rounded-[2px]`}
                      >
                        <Img src={champ(dd, r.champion)} className="h-6 w-6 rounded-[2px]" />
                        <span className={`absolute -bottom-1 -right-1 rounded-[2px] px-0.5 text-[9px] font-bold leading-none ${r.win ? "bg-pulse text-ink-950" : "bg-ember text-ink-950"}`}>
                          {r.win ? "W" : "L"}
                        </span>
                      </span>
                    ))}
                    {s.recent.length > 0 && <span className="ml-2 text-xs text-slate-400">{wins}W {s.recent.length - wins}L</span>}
                  </div>
                  <div className="flex items-center gap-1" title={pick(locale, "Nejvíc mastery bodů", "Najviac mastery bodov", "Top mastery")}>
                    {s.top.map((m) => (
                      <span key={m.championId} className="flex items-center gap-0.5 rounded-[2px] bg-ink-800 pr-1 text-[10px] text-slate-300">
                        <Img src={champ(dd, m.champion)} className="h-5 w-5 rounded-[2px]" />
                        M{m.level}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">{pick(locale, "Scouting se nepodařilo načíst (limit Riotu).", "Scouting sa nepodarilo načítať (limit Riotu).", "Couldn't load scouting (Riot limit).")}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">{pick(locale, "Scouting hry", "Scouting hry", "Game scouting")}</h2>
        <span className="hud-line flex-1" aria-hidden="true" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Team title={pick(locale, "Tvůj tým", "Tvoj tím", "Your team")} players={mine} />
        <Team title={pick(locale, "Nepřátelé", "Nepriatelia", "Enemies")} players={enemy} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{pick(locale, "Co potřebuje tým", "Čo potrebuje tím", "What the game needs")}</p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-200">
            {tips.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
          <p className="text-[11px] text-slate-500">
            {pick(locale, "Orientační odhad podle typu šampionů, ne podle itemů.", "Orientačný odhad podľa typu šampiónov, nie podľa itemov.", "Rough estimate from champion types, not items.")}
          </p>
        </div>

        <div className="card space-y-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {pick(locale, "Tvůj build na ", "Tvoj build na ", "Your build on ")}{myChamp?.championName}
          </p>
          {build ? (
            <>
              <p className="text-sm text-slate-300">
                {build.games} {pick(locale, "her v posledních zápasech", "hier v posledných zápasoch", "recent games")}, {Math.round((build.wins / build.games) * 100)} % {pick(locale, "výher", "výhier", "win rate")}.
                {" "}{pick(locale, "Nejčastější runy a itemy:", "Najčastejšie runy a itemy:", "Most used runes and items:")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Img src={rune(dd, build.keystone)} className="h-8 w-8 rounded-full bg-ink-900" />
                <Img src={rune(dd, build.secondary)} className="h-6 w-6 rounded-full bg-ink-900 p-0.5" />
                <span className="mx-1 text-slate-600">|</span>
                {build.items.map((id) => <Img key={id} src={item(dd, id)} className="h-8 w-8 rounded-[2px]" />)}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">
              {pick(locale, "Na tomhle šampionovi nemáš v načtených zápasech žádnou hru. Přepni profil na 50 her, ať je z čeho brát.", "Na tomto šampiónovi nemáš v načítaných zápasoch žiadnu hru. Prepni profil na 50 hier, nech je z čoho brať.", "No games on this champion in the loaded matches. Switch the profile to 50 games for more data.")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
