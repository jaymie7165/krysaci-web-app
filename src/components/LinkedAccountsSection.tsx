import Link from "next/link";
import { db } from "@/lib/db";
import { pick, type Locale } from "@/lib/i18n";
import { getLolProfile, PLATFORMS, DEFAULT_PLATFORM } from "@/lib/riot";
import { getSteamSummary } from "@/lib/steam";
import { getValorantRank } from "@/lib/valorant";
import LolProfileView from "./LolProfileView";
import SteamGameImg from "./SteamGameImg";
import RankTag from "./RankTag";

/** Propojené účty hráče (Steam, LoL, Valorant) na jeho profilu. Chyby externích služeb sekci nerozbijí. */
export default async function LinkedAccountsSection({ userId, locale, isMe }: { userId: string; locale: Locale; isMe: boolean }) {
  const accounts = await db.linkedAccount.findMany({ where: { userId } });
  const steam = accounts.find((a) => a.provider === "steam");
  const riot = accounts.find((a) => a.provider === "riot");

  const [steamData, lol, val] = await Promise.all([
    steam ? getSteamSummary(steam.externalId).catch(() => null) : null,
    riot && riot.gameName && riot.tagLine
      ? getLolProfile(riot.externalId, riot.gameName, riot.tagLine, riot.region ?? DEFAULT_PLATFORM).catch(() => null)
      : null,
    riot?.shareValorant && riot.verified && riot.gameName && riot.tagLine ? getValorantRank(riot.gameName, riot.tagLine).catch(() => null) : null,
  ]);

  if (!steam && !riot) {
    return isMe ? (
      <section className="card p-5">
        <h2 className="text-xl font-semibold">{pick(locale, "Propojené účty", "Prepojené účty", "Linked accounts")}</h2>
        <p className="mt-1 text-sm text-slate-400">
          {pick(locale, "Propoj Steam a Riot a ukaž tady svůj nick a rank.", "Prepoj Steam a Riot a ukáž tu svoj nick a rank.", "Link Steam and Riot to show your name and rank here.")}
        </p>
        <Link href="/account" className="btn mt-3">{pick(locale, "Propojit účty", "Prepojiť účty", "Link accounts")}</Link>
      </section>
    ) : null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-semibold">{pick(locale, "Propojené účty", "Prepojené účty", "Linked accounts")}</h2>
        {isMe && <Link href="/account" className="text-sm text-accent-soft hover:text-white">{pick(locale, "Spravovat", "Spravovať", "Manage")}</Link>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {steam && (
          <div className="card space-y-3 p-4">
            <div className="flex items-center gap-3">
              {(steamData?.avatar ?? steam.avatarUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={(steamData?.avatar ?? steam.avatarUrl)!} alt="" className="h-12 w-12 rounded-xl" />
              ) : (
                <span className="h-12 w-12 rounded-xl bg-ink-600" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-400">Steam</p>
                <p className="truncate font-display text-lg font-bold text-bone">{steamData?.name ?? steam.displayName}</p>
              </div>
              <a href={steam.profileUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-soft hover:text-white">
                {pick(locale, "Otevřít", "Otvoriť", "Open")}
              </a>
            </div>
            {steamData && steamData.recent.length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {steamData.recent.map((g) => (
                  <li key={g.appId} className="flex items-center gap-3">
                    <SteamGameImg appId={g.appId} name={g.name} icon={g.icon} />
                    <span className="min-w-0 flex-1 truncate text-bone">{g.name}</span>
                    <span className="text-xs text-slate-400">{g.hours2w} h / 2 {pick(locale, "týdny", "týždne", "wks")}</span>
                  </li>
                ))}
              </ul>
            )}
            {steamData && !steamData.isPublic && (
              <p className="text-xs text-slate-500">{pick(locale, "Profil je na Steamu soukromý.", "Profil je na Steame súkromný.", "This Steam profile is private.")}</p>
            )}
          </div>
        )}

        {riot && (
          <div className="card space-y-3 p-4">
            <div className="flex items-center gap-3">
              {riot.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={riot.avatarUrl} alt="" className="h-12 w-12 rounded-xl" />
              ) : (
                <span className="h-12 w-12 rounded-xl bg-ink-600" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-400">Riot Games, {PLATFORMS[riot.region ?? ""]?.label ?? riot.region}</p>
                <p className="truncate font-display text-lg font-bold text-bone">{riot.displayName}</p>
              </div>
              {!riot.verified && <span className="badge" title={pick(locale, "Vlastnictví účtu zatím není ověřeno", "Vlastníctvo účtu zatiaľ nie je overené", "Account ownership isn't verified yet")}>{pick(locale, "Nepotvrzeno", "Nepotvrdené", "Unverified")}</span>}
            </div>
            {val && (
              <div className="rounded-xl bg-ink-900 p-3">
                <p className="text-xs text-slate-400">VALORANT</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <RankTag tier={val.tier} />
                  <span className="font-display text-lg font-bold text-bone">{val.rr} RR</span>
                </div>
                {val.peak && <p className="mt-1 text-xs text-slate-400">{pick(locale, "Nejvyšší rank", "Najvyšší rank", "Peak")}: {val.peak}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {lol && <LolProfileView p={lol} locale={locale} compact />}
    </section>
  );
}
