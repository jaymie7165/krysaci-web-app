import Link from "next/link";
import { auth, signIn, signOut } from "@/lib/auth";
import { getT, pick, LOCALES } from "@/lib/i18n";
import { setLang } from "@/app/actions";
import TopNav, { type NavItem } from "./TopNav";

function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Play Haven">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-mark.png" alt="" className="h-9 w-auto" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-wordmark.png" alt="Play Haven" className="hidden h-3 w-auto sm:block" />
    </Link>
  );
}

export default async function Nav() {
  const session = await auth();
  const { t, locale } = await getT();
  const user = session?.user;

  const community: [string, string][] = [
    ["/players", t("nav_players")],
    ["/lfg", t("nav_lfg")],
    ["/customs", t("nav_customs")],
  ];
  community.push(["/now", pick(locale, "Co se děje teď", "Čo sa deje teraz", "What's happening")]);
  community.push(["/news", pick(locale, "Novinky", "Novinky", "News")]);
  if (user) community.push(["/friends", t("nav_friends")]);

  const items: NavItem[] = [
    { type: "link", href: "/", label: "Hub" },
    { type: "link", href: "/esports", label: "Esport", tone: "gold" },
    { type: "link", href: "/lookup", label: pick(locale, "Statistiky", "Štatistiky", "Stats") },
    { type: "link", href: "/live", label: "Live" },
    { type: "menu", label: pick(locale, "Komunita", "Komunita", "Community"), links: community },
    {
      type: "menu",
      label: pick(locale, "Soutěže", "Súťaže", "Compete"),
      links: [
        ["/tournaments", t("nav_tournaments")],
        ["/pickems", "Pickems"],
        ["/leaderboards", t("nav_leaderboards")],
        ["/vote", t("nav_vote")],
      ],
    },
    { type: "link", href: "/games", label: t("nav_games") },
  ];

  const langs = (
    <div className="hidden gap-0.5 sm:flex">
      {LOCALES.map((l) => (
        <form key={l} action={setLang.bind(null, l)}>
          <button
            className={`rounded-sm px-2 py-1 text-xs font-semibold uppercase ${
              l === locale ? "bg-ink-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {l}
          </button>
        </form>
      ))}
    </div>
  );

  const account = user ? (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-9 w-9 rounded-sm border border-ink-600" />
        ) : (
          <span className="h-9 w-9 rounded-sm bg-ink-600" />
        )}
        <span className="hidden max-w-32 truncate text-sm font-semibold text-white md:block">{user.name}</span>
      </summary>
      <div className="card absolute right-0 top-full z-50 mt-2 w-56 py-1 shadow-2xl">
        <Link href={`/players/${user.handle}`} className="menu-item">{t("nav_profile")}</Link>
        <Link href="/account" className="menu-item">{pick(locale, "Propojené účty", "Prepojené účty", "Linked accounts")}</Link>
        <Link href="/tickets" className="menu-item">{t("nav_tickets")}</Link>
        {user.role === "ADMIN" && <Link href="/admin" className="menu-item">Admin</Link>}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button className="menu-item w-full text-left">{t("logout")}</button>
        </form>
      </div>
    </details>
  ) : (
    <form
      action={async () => {
        "use server";
        await signIn("discord", { redirectTo: "/" });
      }}
    >
      <button className="btn">{t("login")}</button>
    </form>
  );

  return (
    <TopNav items={items} logo={<Logo />}>
      <form action="/search" className="hidden md:block">
        <input
          name="q"
          type="search"
          aria-label={pick(locale, "Hledat", "Hľadať", "Search")}
          placeholder={pick(locale, "Hledat…", "Hľadať…", "Search…")}
          className="input h-9 w-36 py-1 text-sm lg:w-44"
        />
      </form>
      {langs}
      {account}
    </TopNav>
  );
}
