import Link from "next/link";
import { auth, signIn, signOut } from "@/lib/auth";
import { getT, LOCALES } from "@/lib/i18n";
import { setLang } from "@/app/actions";

export default async function Nav() {
  const session = await auth();
  const { t, locale } = await getT();

  const links = [
    ["/games", t("nav_games")],
    ["/players", t("nav_players")],
    ["/leaderboards", t("nav_leaderboards")],
    ["/tournaments", t("nav_tournaments")],
    ["/customs", t("nav_customs")],
    ["/lfg", t("nav_lfg")],
    ["/vote", t("nav_vote")],
  ] as const;

  return (
    <header className="sticky top-0 z-30 border-b border-ink-600/60 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="font-display text-2xl font-bold tracking-wider text-white">
          KRYS<span className="text-accent">ÁCI</span>
        </Link>
        <nav className="hidden flex-1 gap-5 text-sm font-medium text-slate-300 md:flex">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="transition hover:text-white">
              {label}
            </Link>
          ))}
          {session?.user && (
            <>
              <Link href="/friends" className="transition hover:text-white">{t("nav_friends")}</Link>
              <Link href="/tickets" className="transition hover:text-white">{t("nav_tickets")}</Link>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-1">
            {LOCALES.map((l) => (
              <form key={l} action={setLang.bind(null, l)}>
                <button
                  className={`rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${
                    l === locale ? "bg-accent text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {l}
                </button>
              </form>
            ))}
          </div>
          {session?.user ? (
            <>
              <Link href={`/players/${session.user.handle}`} className="flex items-center gap-2">
                {session.user.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt="" className="h-8 w-8 rounded-full" />
                )}
                <span className="hidden text-sm font-medium text-white lg:inline">{session.user.name}</span>
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button className="btn-ghost">{t("logout")}</button>
              </form>
            </>
          ) : (
            <form
              action={async () => {
                "use server";
                await signIn("discord", { redirectTo: "/" });
              }}
            >
              <button className="btn">{t("login")}</button>
            </form>
          )}
        </div>
      </div>
      <nav className="flex gap-4 overflow-x-auto border-t border-ink-600/40 px-4 py-2 text-sm text-slate-300 md:hidden">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="whitespace-nowrap">
            {label}
          </Link>
        ))}
        {session?.user && (
          <>
            <Link href="/friends" className="whitespace-nowrap">{t("nav_friends")}</Link>
            <Link href="/tickets" className="whitespace-nowrap">{t("nav_tickets")}</Link>
          </>
        )}
      </nav>
    </header>
  );
}
