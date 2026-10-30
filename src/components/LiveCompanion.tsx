"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ScoutPlayerOut, ScoutRequestPlayer, ScoutResponse } from "@/lib/scoutTypes";

type Member = { cellId: number; puuid: string | null; summonerId: number; championId: number; position: string; name: string | null };
type LcuState = {
  connected: boolean;
  phase: string;
  me: { puuid: string; name: string } | null;
  platform: string | null;
  champSelect: { localCellId: number; myTeam: Member[]; theirTeam: Member[]; bans: { my: number[]; their: number[] } } | null;
};
type Bridge = {
  isApp: boolean;
  info: () => Promise<{ version: string; site: string; alwaysOnTop: boolean }>;
  getState: () => Promise<LcuState>;
  onState: (cb: (s: LcuState) => void) => () => void;
  setAlwaysOnTop: (on: boolean) => Promise<boolean>;
};
declare global {
  interface Window { playhaven?: Bridge }
}

const CDN = "https://ddragon.leagueoflegends.com/cdn";
const POS: Record<string, string> = { top: "Top", jungle: "Jungle", middle: "Mid", bottom: "ADC", utility: "Support" };

export default function LiveCompanion({ locale, noDownload }: { locale: string; noDownload: boolean }) {
  const L = (cs: string, sk: string, en: string) => (locale === "sk" ? sk : locale === "en" ? en : cs);
  const [isApp, setIsApp] = useState<boolean | null>(null);
  const [state, setState] = useState<LcuState | null>(null);
  const [data, setData] = useState<ScoutResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [top, setTop] = useState(false);
  const [version, setVersion] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    const b = window.playhaven;
    setIsApp(!!b?.isApp);
    if (!b) return;
    b.info().then((i) => { setVersion(i.version); setTop(i.alwaysOnTop); }).catch(() => null);
    b.getState().then(setState).catch(() => null);
    return b.onState(setState);
  }, []);

  // Při loadingu a ve hře zjistíme hráče obou týmů ze Spectatoru (puuid + šampioni).
  const [game, setGame] = useState<{ players: { puuid: string; teamId: number; championId: number }[] } | null>(null);
  const inGame = !!state && ["GameStart", "InProgress", "Reconnect"].includes(state.phase);
  useEffect(() => {
    if (!inGame || !state?.me || !state.platform) { setGame(null); return; }
    let stop = false;
    const me = state.me.puuid;
    const platform = state.platform;
    const load = async () => {
      try {
        const r = await fetch("/api/live/game", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform, puuid: me }) });
        if (r.ok) {
          const j = await r.json();
          if (!stop) setGame(j.game ?? null);
          if (j.game) return; // máme hru, stačí
        }
      } catch { /* zkusíme znovu */ }
      if (!stop) setTimeout(load, 8000);
    };
    load();
    return () => { stop = true; };
  }, [inGame, state?.me?.puuid, state?.platform]); // eslint-disable-line react-hooks/exhaustive-deps

  // Požadavek na scouting podle fáze.
  const request = useMemo(() => {
    if (!state?.connected || !state.platform) return null;
    const mePuuid = state.me?.puuid;
    if (state.phase === "ChampSelect" && state.champSelect) {
      const cs = state.champSelect;
      const mine: ScoutRequestPlayer[] = cs.myTeam.map((m) => ({ puuid: m.puuid, championId: m.championId, team: "mine", position: m.position, name: m.name }));
      const enemy: ScoutRequestPlayer[] = cs.theirTeam.map((m) => ({ puuid: null, championId: m.championId, team: "enemy", position: m.position }));
      const my = cs.myTeam.find((m) => m.cellId === cs.localCellId);
      return { platform: state.platform, mePuuid, myChampionId: my?.championId || undefined, players: [...mine, ...enemy] };
    }
    if (inGame && game && mePuuid) {
      const myTeam = game.players.find((p) => p.puuid === mePuuid)?.teamId;
      const players: ScoutRequestPlayer[] = game.players.map((p) => ({ puuid: p.puuid, championId: p.championId, team: p.teamId === myTeam ? "mine" : "enemy" }));
      return { platform: state.platform, mePuuid, myChampionId: game.players.find((p) => p.puuid === mePuuid)?.championId, players };
    }
    return null;
  }, [state, game, inGame]);
  const key = request ? JSON.stringify(request) : "";

  useEffect(() => {
    if (!request) { setData(null); return; }
    const my = ++seq.current;
    const run = async (attempt = 0) => {
      setBusy(true);
      try {
        const r = await fetch("/api/live/scout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
        if (my !== seq.current) return;
        if (r.status === 429 && attempt < 3) { setTimeout(() => run(attempt + 1), 2000); return; }
        if (r.status === 401) { setErr(L("Přihlas se na webu přes Discord.", "Prihlás sa na webe cez Discord.", "Sign in with Discord on the site.")); setBusy(false); return; }
        if (!r.ok) throw new Error(String(r.status));
        setData(await r.json());
        setErr(null);
      } catch {
        if (my === seq.current) setErr(L("Scouting se nepodařilo načíst. Zkusím to znovu při další změně.", "Scouting sa nepodarilo načítať. Skúsim to znova pri ďalšej zmene.", "Couldn't load scouting. I'll retry on the next change."));
      }
      if (my === seq.current) setBusy(false);
    };
    const t = setTimeout(() => run(), 700); // sloučí rychlé změny při výběru šampionů
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Mimo aplikaci: nabídka ke stažení ---------- */
  if (isApp === null) return null;
  if (!isApp)
    return (
      <div className="panel panel-edge space-y-5 p-6 md:p-10">
        <h1 className="text-3xl font-bold md:text-4xl">{L("Play Haven pro počítač", "Play Haven pre počítač", "Play Haven for desktop")}</h1>
        <p className="max-w-2xl text-slate-300">
          {L(
            "Malá aplikace, která sedí vedle League of Legends. V champ selectu ukáže rank, posledních 5 her a nejhranější šampiony tvých spoluhráčů, po načtení hry i nepřátel, a poradí, co potřebuje tým.",
            "Malá aplikácia, ktorá sedí vedľa League of Legends. V champ selecte ukáže rank, posledných 5 hier a najhranejších šampiónov tvojich spoluhráčov, po načítaní hry aj nepriateľov, a poradí, čo potrebuje tím.",
            "A small app that sits next to League of Legends. In champ select it shows your teammates' rank, last 5 games and most played champions, the enemies once the game loads, and what your team needs."
          )}
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
          <li>{L("Jeden soubor, bez instalace. Stáhneš, spustíš, přihlásíš se přes Discord.", "Jeden súbor, bez inštalácie. Stiahneš, spustíš, prihlásiš sa cez Discord.", "One file, no install. Download, run, sign in with Discord.")}</li>
          <li>{L("Jen čte data z klienta. Nic nehraje za tebe a nic nemění.", "Len číta dáta z klienta. Nič nehrá za teba a nič nemení.", "It only reads client data. It doesn't play for you or change anything.")}</li>
          <li>{L("Běží v liště a upozorní, když začne champ select.", "Beží v lište a upozorní, keď začne champ select.", "Runs in the tray and notifies you when champ select starts.")}</li>
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/api/download" className="btn">{L("Stáhnout pro Windows", "Stiahnuť pre Windows", "Download for Windows")}</a>
          <span className="text-xs text-slate-500">
            {L("Windows může při prvním spuštění ukázat varování, protože aplikace zatím není podepsaná. Zvol Další informace a Přesto spustit.", "Windows môže pri prvom spustení ukázať varovanie, pretože aplikácia zatiaľ nie je podpísaná. Zvoľ Ďalšie informácie a Aj tak spustiť.", "Windows may show a warning on first run because the app isn't code-signed yet. Choose More info, then Run anyway.")}
          </span>
        </div>
        {noDownload && (
          <p className="border border-ember/40 bg-ember/10 p-3 text-sm text-ember">
            {L("Stažení zatím není nastavené. Správce webu musí nahrát aplikaci a nastavit DESKTOP_GITHUB_REPO nebo DESKTOP_DOWNLOAD_URL.", "Stiahnutie zatiaľ nie je nastavené. Správca webu musí nahrať aplikáciu a nastaviť DESKTOP_GITHUB_REPO alebo DESKTOP_DOWNLOAD_URL.", "Download isn't set up yet. The site admin needs to upload the app and set DESKTOP_GITHUB_REPO or DESKTOP_DOWNLOAD_URL.")}
          </p>
        )}
      </div>
    );

  /* ---------- V aplikaci ---------- */
  const phase = state?.phase ?? "None";
  const phaseText: Record<string, [string, string, string]> = {
    None: ["Klient je ve výchozím stavu", "Klient je vo východiskovom stave", "Client is idle"],
    Lobby: ["V lobby, čekám na champ select", "V lobby, čakám na champ select", "In lobby, waiting for champ select"],
    Matchmaking: ["Hledá se hra", "Hľadá sa hra", "Searching for a game"],
    ReadyCheck: ["Hra nalezena", "Hra nájdená", "Match found"],
    ChampSelect: ["Champ select", "Champ select", "Champ select"],
    GameStart: ["Načítání hry", "Načítavanie hry", "Game loading"],
    InProgress: ["Hra běží", "Hra beží", "Game in progress"],
    Reconnect: ["Hra běží", "Hra beží", "Game in progress"],
    PreEndOfGame: ["Hra skončila", "Hra skončila", "Game ended"],
    WaitingForStats: ["Hra skončila", "Hra skončila", "Game ended"],
    EndOfGame: ["Hra skončila", "Hra skončila", "Game ended"],
  };
  const pt = phaseText[phase] ?? phaseText.None;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${state?.connected ? "bg-pulse" : "bg-slate-500"}`} aria-hidden="true" />
        <h1 className="text-2xl font-bold">
          {state?.connected ? L(...pt) : L("Čekám na League klient", "Čakám na League klient", "Waiting for the League client")}
        </h1>
        {state?.connected && state.me && <span className="badge">{state.me.name}</span>}
        <span className="ml-auto flex items-center gap-3 text-xs text-slate-500">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={top}
              onChange={(e) => window.playhaven?.setAlwaysOnTop(e.target.checked).then(setTop)}
            />
            {L("Okno vždy nahoře", "Okno vždy hore", "Always on top")}
          </label>
          {version && <span>v{version}</span>}
        </span>
      </div>

      {!state?.connected && (
        <p className="card p-5 text-slate-300">
          {L("Spusť League of Legends a přihlas se do klienta. Aplikace se připojí sama, ve chvíli, kdy začne champ select, tu ukážu scouting.", "Spusti League of Legends a prihlás sa do klienta. Aplikácia sa pripojí sama, vo chvíli, keď začne champ select, tu ukážem scouting.", "Start League of Legends and sign in to the client. The app connects by itself and shows scouting when champ select starts.")}
        </p>
      )}
      {state?.connected && !request && (
        <p className="card p-5 text-slate-300">
          {inGame
            ? L("Hledám hru u Riotu (načtení může trvat až minutu)…", "Hľadám hru u Riotu (načítanie môže trvať až minútu)…", "Looking up the game at Riot (can take up to a minute)…")
            : L("Až se začne vybírat šampion, uvidíš tady spoluhráče a doporučení.", "Keď sa začne vyberať šampión, uvidíš tu spoluhráčov a odporúčania.", "When champion select starts, your teammates and recommendations show up here.")}
        </p>
      )}
      {err && <p role="alert" className="border border-ember/40 bg-ember/10 p-3 text-sm text-ember">{err}</p>}

      {request && data && <Board data={data} busy={busy} L={L} />}
      {request && !data && !err && <p className="text-sm text-slate-400">{L("Načítám scouting…", "Načítavam scouting…", "Loading scouting…")}</p>}
    </div>
  );
}

/* ---------- Zobrazení ---------- */

const champImg = (v: string, id: string) => (id ? `${CDN}/${v}/img/champion/${id}.png` : "");
const rankText = (r: ScoutPlayerOut["rank"]) =>
  r ? `${r.tier[0] + r.tier.slice(1).toLowerCase()}${["MASTER", "GRANDMASTER", "CHALLENGER"].includes(r.tier) ? "" : " " + r.division} ${r.lp} LP` : null;

function Pic({ src, className, title }: { src: string; className: string; title?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" title={title} loading="lazy" className={className} /> : <span className={`block bg-ink-700 ${className}`} />;
}

function Board({ data, busy, L }: { data: ScoutResponse; busy: boolean; L: (cs: string, sk: string, en: string) => string }) {
  const v = data.version;
  const mine = data.players.filter((p) => p.team === "mine");
  const enemy = data.players.filter((p) => p.team === "enemy");

  const Row = ({ p }: { p: ScoutPlayerOut }) => {
    const wins = p.recent.filter((r) => r.win).length;
    const total = p.rank ? p.rank.wins + p.rank.losses : 0;
    return (
      <li className={`rounded-lg p-2 ${p.me ? "bg-accent/20" : "bg-ink-900/70"}`}>
        <div className="flex items-center gap-2">
          {p.champion ? <Pic src={champImg(v, p.champion)} className="h-10 w-10 shrink-0 rounded-[2px]" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[2px] bg-ink-700 text-xs text-slate-500">?</span>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-bone">
              {p.name ?? (p.puuid ? "…" : L("Skrytý hráč", "Skrytý hráč", "Hidden player"))}
              {p.position && <span className="ml-2 text-xs text-slate-500">{POS[p.position] ?? ""}</span>}
            </p>
            <p className="truncate text-xs text-slate-400">
              {p.championName || L("vybírá…", "vyberá…", "picking…")}
              {rankText(p.rank) ? `, ${rankText(p.rank)}, ${total ? Math.round((p.rank!.wins / total) * 100) : 0} % WR` : p.puuid ? `, ${L("bez ranku", "bez ranku", "unranked")}` : ""}
            </p>
          </div>
        </div>
        {p.puuid && !p.failed && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1" title={L("Posledních 5 ranked solo/duo her", "Posledných 5 ranked solo/duo hier", "Last 5 ranked solo/duo games")}>
              {p.recent.length === 0 && <span className="text-xs text-slate-500">{L("žádné ranked solo hry", "žiadne ranked solo hry", "no ranked solo games")}</span>}
              {p.recent.map((r) => (
                <span key={r.id} title={`${r.champion}: ${r.kills}/${r.deaths}/${r.assists}`} className={`relative inline-block rounded-[2px] ring-1 ${r.win ? "ring-pulse" : "ring-ember"}`}>
                  <Pic src={champImg(v, r.champion)} className="h-6 w-6 rounded-[2px]" />
                  <span className={`absolute -bottom-1 -right-1 rounded-[2px] px-0.5 text-[9px] font-bold leading-none ${r.win ? "bg-pulse text-ink-950" : "bg-ember text-ink-950"}`}>{r.win ? "W" : "L"}</span>
                </span>
              ))}
              {p.recent.length > 0 && <span className="ml-2 text-xs text-slate-400">{wins}W {p.recent.length - wins}L</span>}
            </div>
            <div className="flex items-center gap-1" title={L("Nejvíc mastery bodů", "Najviac mastery bodov", "Top mastery")}>
              {p.top.map((m) => (
                <span key={m.championId} className="flex items-center gap-0.5 rounded-[2px] bg-ink-800 pr-1 text-[10px] text-slate-300">
                  <Pic src={champImg(v, m.champion)} className="h-5 w-5 rounded-[2px]" />M{m.level}
                </span>
              ))}
            </div>
          </div>
        )}
        {p.failed && <p className="mt-2 text-xs text-slate-500">{L("Scouting se nepodařilo načíst (limit Riotu).", "Scouting sa nepodarilo načítať (limit Riotu).", "Couldn't load scouting (Riot limit).")}</p>}
      </li>
    );
  };

  const Team = ({ title, list }: { title: string; list: ScoutPlayerOut[] }) => (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <ul className="space-y-1.5">{list.map((p, i) => <Row key={(p.puuid ?? "x") + i} p={p} />)}</ul>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Team title={L("Tvůj tým", "Tvoj tím", "Your team")} list={mine} />
        <Team title={L("Nepřátelé", "Nepriatelia", "Enemies")} list={enemy} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{L("Co potřebuje tým", "Čo potrebuje tím", "What the game needs")}</p>
          {data.advice.length === 0 ? (
            <p className="text-sm text-slate-400">{L("Poradím, jakmile bude vybráno víc šampionů.", "Poradím, hneď ako bude vybraných viac šampiónov.", "I'll advise once more champions are picked.")}</p>
          ) : (
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-200">{data.advice.map((a, i) => <li key={i}>{a}</li>)}</ul>
          )}
          <p className="text-[11px] text-slate-500">{L("Orientační odhad podle typu šampionů, ne podle itemů.", "Orientačný odhad podľa typu šampiónov, nie podľa itemov.", "Rough estimate from champion types, not items.")}</p>
        </div>
        <div className="card space-y-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {data.build ? `${L("Tvůj build na", "Tvoj build na", "Your build on")} ${data.build.championName}` : L("Tvůj build", "Tvoj build", "Your build")}
          </p>
          {data.build ? (
            <>
              <p className="text-sm text-slate-300">
                {data.build.games} {L("her", "hier", "games")}, {Math.round((data.build.wins / data.build.games) * 100)} % {L("výher", "výhier", "win rate")}. {L("Nejčastější runy a itemy:", "Najčastejšie runy a itemy:", "Most used runes and items:")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Pic src={data.runes[String(data.build.keystone)] ? `${CDN}/img/${data.runes[String(data.build.keystone)]}` : ""} className="h-8 w-8 rounded-full bg-ink-900" />
                <Pic src={data.runes[String(data.build.secondary)] ? `${CDN}/img/${data.runes[String(data.build.secondary)]}` : ""} className="h-6 w-6 rounded-full bg-ink-900 p-0.5" />
                <span className="mx-1 text-slate-600">|</span>
                {data.build.items.map((id) => <Pic key={id} src={`${CDN}/${v}/img/item/${id}.png`} className="h-8 w-8 rounded-[2px]" />)}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">
              {L("Ukáže se, když máš na webu ověřený Riot účet a tohoto šampiona ve svých posledních hrách.", "Ukáže sa, keď máš na webe overený Riot účet a tohto šampióna vo svojich posledných hrách.", "Shows when you have a verified Riot account on the site and this champion in your recent games.")}
            </p>
          )}
        </div>
      </div>
      {busy && <p className="text-xs text-slate-500">{L("Aktualizuji…", "Aktualizujem…", "Updating…")}</p>}
    </div>
  );
}
