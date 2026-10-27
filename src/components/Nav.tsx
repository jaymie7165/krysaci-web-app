import Link from "next/link";
import { auth, signIn, signOut } from "@/lib/auth";
import { getT, LOCALES } from "@/lib/i18n";
import { setLang } from "@/app/actions";
import NavLinks from "./NavLinks";

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Play Haven">
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden="true">
        <path d="M14 50V30a18 18 0 0 1 36 0v20z" fill="none" stroke="#ece7db" strokeWidth="4" strokeLinejoin="round" />
        <circle cx="32" cy="36" r="6" fill="#f2a93b" />
      </svg>
      <span className="font-display text-xl font-bold tracking-tight text-bone">Play Haven</span>
    </Link>
  );
}

export default async function Nav() {
  const session = await auth();
  const { t, locale } = await getT();

  const links: [string, string][] = [
    ["/", "Hub"],
    ["/games", t("nav_games")],
    ["/players", t("nav_players")],
    ["/leaderboards", t("nav_leaderboards")],
    ["/tournaments", t("nav_tournaments")],
    ["/customs", t("nav_customs")],
    ["/lfg", t("nav_lfg")],
    ["/vote", t("nav_vote")],
  ];
  if (session?.user) {
    links.push(["/friends", t("nav_friends")], ["/tickets", t("nav_tickets")]);
  }

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

  const account = session?.user ? (
    <div className="flex items-center gap-2">
      <Link href={`/players/${session.user.handle}`} className="flex min-w-0 items-center gap-2">
        {session.user.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="h-8 w-8 shrink-0 rounded-full" />
        )}
        <span className="truncate text-sm font-medium text-white">{session.user.name}</span>
      </Link>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button className="rounded-md px-2 py-1 text-xs text-slate-400 hover:text-white">{t("logout")}</button>
      </form>
    </div>
  ) : (
    <form
      action={async () => {
        "use server";
        await signIn("discord", { redirectTo: "/" });
      }}
    >
      <button className="btn w-full">{t("login")}</button>
    </form>
  );

  return (
    <aside className="border-b border-ink-600/50 bg-ink-900 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
      {/* Mobil: horní lišta */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-3">
            {langs}
            {session?.user ? (
              <Link href={`/players/${session.user.handle}`} aria-label={t("nav_profile")}>
                {session.user.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt="" className="h-8 w-8 rounded-full" />
                )}
              </Link>
            ) : (
              account
            )}
          </div>
        </div>
        <NavLinks links={links} orientation="horizontal" />
      </div>

      {/* Desktop: boční panel */}
      <div className="hidden h-full flex-col gap-6 p-4 lg:flex">
        <div className="px-2 pt-1">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks links={links} orientation="vertical" />
        </div>
        <div className="space-y-3 border-t border-ink-600/50 pt-4">
          {langs}
          {account}
        </div>
      </div>
    </aside>
  );
}
