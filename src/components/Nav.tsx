import Link from "next/link";
import { auth, signIn, signOut } from "@/lib/auth";
import { getT, pick, LOCALES } from "@/lib/i18n";
import { setLang } from "@/app/actions";
import NavLinks, { type NavGroup } from "./NavLinks";

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="Play Haven">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-mark.png" alt="" className="h-10 w-auto" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-wordmark.png" alt="Play Haven" className="h-3.5 w-auto" />
    </Link>
  );
}

export default async function Nav() {
  const session = await auth();
  const { t, locale } = await getT();
  const user = session?.user;

  const groups: NavGroup[] = [
    {
      links: [
        ["/", "Hub"],
        ["/lookup", pick(locale, "Statistiky", "Štatistiky", "Stats")],
      ],
    },
    {
      title: pick(locale, "Komunita", "Komunita", "Community"),
      links: [
        ["/players", t("nav_players")],
        ["/lfg", t("nav_lfg")],
        ...(user ? ([["/friends", t("nav_friends")]] as [string, string][]) : []),
      ],
    },
    {
      title: pick(locale, "Soutěže", "Súťaže", "Compete"),
      links: [
        ["/tournaments", t("nav_tournaments")],
        ["/customs", t("nav_customs")],
        ["/leaderboards", t("nav_leaderboards")],
      ],
    },
    {
      title: pick(locale, "Další", "Ďalšie", "More"),
      links: [
        ["/games", t("nav_games")],
        ["/vote", t("nav_vote")],
        ...(user ? ([["/tickets", t("nav_tickets")]] as [string, string][]) : []),
      ],
    },
  ];

  const langs = (
    <div className="flex gap-1">
      {LOCALES.map((l) => (
        <form key={l} action={setLang.bind(null, l)}>
          <button
            className={`rounded-md px-2 py-1 text-xs font-semibold uppercase ${
              l === locale ? "bg-ink-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {l}
          </button>
        </form>
      ))}
    </div>
  );

  const loginForm = (
    <form
      action={async () => {
        "use server";
        await signIn("discord", { redirectTo: "/" });
      }}
    >
      <button className="btn w-full">{t("login")}</button>
    </form>
  );

  const account = user ? (
    <div className="space-y-2">
      <Link href={`/players/${user.handle}`} className="flex min-w-0 items-center gap-2">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-9 w-9 shrink-0 rounded-full" />
        ) : (
          <span className="h-9 w-9 shrink-0 rounded-full bg-ink-600" />
        )}
        <span className="truncate text-sm font-medium text-white">{user.name}</span>
      </Link>
      <div className="flex items-center justify-between text-xs">
        <Link href="/account" className="text-slate-400 hover:text-white">
          {pick(locale, "Propojené účty", "Prepojené účty", "Linked accounts")}
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button className="text-slate-400 hover:text-white">{t("logout")}</button>
        </form>
      </div>
    </div>
  ) : (
    loginForm
  );

  return (
    <aside className="border-b border-ink-600/50 bg-ink-900 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
      {/* Mobil: horní lišta */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-3">
            {langs}
            {user ? (
              <Link href={`/players/${user.handle}`} aria-label={t("nav_profile")}>
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt="" className="h-8 w-8 rounded-full" />
                ) : (
                  <span className="block h-8 w-8 rounded-full bg-ink-600" />
                )}
              </Link>
            ) : (
              loginForm
            )}
          </div>
        </div>
        <NavLinks groups={groups} orientation="horizontal" />
      </div>

      {/* Desktop: boční panel */}
      <div className="hidden h-full flex-col gap-7 p-4 lg:flex">
        <div className="px-2 pt-2">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks groups={groups} orientation="vertical" />
        </div>
        <div className="space-y-3 border-t border-ink-600/50 pt-4">
          {langs}
          {account}
        </div>
      </div>
    </aside>
  );
}
