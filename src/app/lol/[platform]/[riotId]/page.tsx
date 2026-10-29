import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getT, pick } from "@/lib/i18n";
import { PLATFORMS, RiotError, findAccount, getLiveGame, getLolProfile, getRankHistory, parseRiotId } from "@/lib/riot";
import LolProfileView from "@/components/LolProfileView";
import LolSearch from "@/components/LolSearch";
import LiveScout from "@/components/LiveScout";
import { Suspense } from "react";

export const metadata = { title: "LoL profil" };

function safeDecode(s: string) {
  try { return decodeURIComponent(s); } catch { return s; }
}

export default async function LolPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string; riotId: string }>;
  searchParams: Promise<{ games?: string }>;
}) {
  const { platform, riotId } = await params;
  const { games } = await searchParams;
  const count = games === "50" ? 50 : 20;
  const { locale } = await getT();
  const session = await auth();
  const id = parseRiotId(safeDecode(riotId));

  const fail = (title: string, text: string) => (
    <div className="space-y-6">
      <LolSearch locale={locale} size="md" />
      <div className="card max-w-2xl p-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-slate-400">{text}</p>
      </div>
    </div>
  );

  if (!id || !(platform in PLATFORMS)) {
    return fail(
      pick(locale, "Neplatné Riot ID", "Neplatné Riot ID", "Invalid Riot ID"),
      pick(locale, "Zadej ho ve tvaru Jmeno#TAG a vyber server.", "Zadaj ho v tvare Meno#TAG a vyber server.", "Use the format Name#TAG and pick a server.")
    );
  }

  let profile;
  try {
    const acc = await findAccount(id.gameName, id.tagLine, platform);
    profile = await getLolProfile(acc.puuid, acc.gameName, acc.tagLine, platform, count);
  } catch (e) {
    const status = e instanceof RiotError ? e.status : 0;
    if (status === 404)
      return fail(pick(locale, "Hráč nenalezen", "Hráč nenájdený", "Player not found"),
        pick(locale, "Zkontroluj Riot ID a zvolený server.", "Skontroluj Riot ID a zvolený server.", "Check the Riot ID and the selected server."));
    if (status === 429)
      return fail(pick(locale, "Moc dotazů", "Príliš veľa dotazov", "Too many requests"),
        pick(locale, "Zkus to znovu za minutu.", "Skús to znova o minútu.", "Try again in a minute."));
    if (status === 503 || status === 401 || status === 403)
      return fail(pick(locale, "Statistiky LoL jsou dočasně vypnuté", "Štatistiky LoL sú dočasne vypnuté", "LoL stats are temporarily off"),
        pick(locale, "Správce webu musí nastavit platný RIOT_API_KEY.", "Správca webu musí nastaviť platný RIOT_API_KEY.", "The site admin needs to set a valid RIOT_API_KEY."));
    return fail(pick(locale, "Načtení se nepovedlo", "Načítanie sa nepodarilo", "Couldn't load stats"),
      pick(locale, "Zkus to prosím za chvíli znovu.", "Skús to prosím o chvíľu znova.", "Please try again shortly."));
  }

  const [history, live] = await Promise.all([
    getRankHistory(profile.puuid),
    getLiveGame(profile.puuid, platform).catch(() => null),
  ]);

  const linked = await db.linkedAccount.findFirst({
    where: { provider: "riot", externalId: profile.puuid, verified: true },
    include: { user: true },
  });

  const actions = linked ? (
    <Link href={`/players/${linked.user.handle}`} className="btn-ghost">
      {pick(locale, "Profil na Play Haven", "Profil na Play Haven", "Play Haven profile")} @{linked.user.handle}
    </Link>
  ) : session?.user ? (
    <Link href="/account" className="btn-ghost">
      {pick(locale, "Je to tvůj účet? Propoj ho", "Je to tvoj účet? Prepoj ho", "Your account? Link it")}
    </Link>
  ) : null;

  return (
    <div className="space-y-6">
      <LolSearch locale={locale} size="md" />
      <LolProfileView
        p={profile}
        locale={locale}
        actions={actions}
        history={history}
        live={live}
        scout={
          live ? (
            <Suspense
              fallback={
                <p className="card p-5 text-sm text-slate-400">
                  {pick(locale, "Načítám scouting hráčů ve hře…", "Načítavam scouting hráčov v hre…", "Loading scouting for the game…")}
                </p>
              }
            >
              <LiveScout live={live} p={profile} locale={locale} />
            </Suspense>
          ) : null
        }
        gamesParam={`/lol/${platform}/${encodeURIComponent(profile.gameName)}-${encodeURIComponent(profile.tagLine)}`}
      />
    </div>
  );
}
