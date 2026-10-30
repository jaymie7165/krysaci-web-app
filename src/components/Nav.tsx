import Link from "next/link";
import { auth, signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, pick, LOCALES } from "@/lib/i18n";
import { getTheme } from "@/lib/theme";
import { setLang } from "@/app/actions";
import TopNav, { type TopTab } from "./TopNav";
import Logo from "./Logo";
import Sidebar from "./Sidebar";
import ThemePicker from "./ThemePicker";

export default async function Nav() {
  const session = await auth();
  const { t, locale } = await getT();
  const user = session?.user;
  const theme = await getTheme();
  const pending = user
    ? await db.notification.count({ where: { userId: user.id, readAt: null } }).catch(() => 0)
    : 0;
  const L = (cs: string, sk: string, en: string) => pick(locale, cs, sk, en);

  const tabs: TopTab[] = [
    { href: "/", label: L("Komunita", "Komunita", "Community") },
    { href: "/games", label: t("nav_games") },
    { href: "/esports", label: "Esport", tone: "gold" },
    { href: "/lookup", label: L("Statistiky", "Štatistiky", "Stats") },
    { href: "/news", label: L("Novinky", "Novinky", "News") },
  ];

  const search = (
    <form action="/search" className="relative hidden md:block">
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.200-4.200" />
      </svg>
      <input
        name="q"
        type="search"
        aria-label={L("Hledat", "Hľadať", "Search")}
        placeholder={L("Hledat na Play Haven…", "Hľadať na Play Haven…", "Search Play Haven…")}
        className="input h-10 w-56 rounded-full bg-ink-800/80 pl-9 lg:w-72"
      />
    </form>
  );

  const palette = (
    <details className="relative">
      <summary
        className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full text-slate-300 hover:bg-ink-700 hover:text-white [&::-webkit-details-marker]:hidden"
        aria-label={L("Barva webu", "Farba webu", "Site colour")}
        title={L("Barva webu", "Farba webu", "Site colour")}
      >
        <span className="h-5 w-5 rounded-full border-2 border-white/70 bg-accent" />
      </summary>
      <div className="card absolute right-0 top-full z-50 mt-2 w-56 space-y-2 p-3 shadow-2xl">
        <p className="text-xs font-semibold text-slate-400">{L("Barva webu", "Farba webu", "Site colour")}</p>
        <ThemePicker current={theme} locale={locale} />
      </div>
    </details>
  );

  const bell = user ? (
    <Link href="/notifications" aria-label={L("Oznámení", "Oznámenia", "Notifications")} className="relative grid h-9 w-9 place-items-center rounded-full text-slate-300 hover:bg-ink-700 hover:text-white">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 0 0 4 0" />
      </svg>
      {pending > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-on">{pending}</span>}
    </Link>
  ) : null;

  const langs = (
    <div className="hidden gap-0.5 sm:flex">
      {LOCALES.map((l) => (
        <form key={l} action={setLang.bind(null, l)}>
          <button className={`rounded-md px-2 py-1 text-xs font-semibold uppercase ${l === locale ? "bg-ink-600 text-white" : "text-slate-400 hover:text-white"}`}>{l}</button>
        </form>
      ))}
    </div>
  );

  const account = user ? (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-9 w-9 rounded-full border border-ink-600" />
        ) : (
          <span className="h-9 w-9 rounded-full bg-ink-600" />
        )}
        <span className="hidden leading-tight md:block">
          <span className="block max-w-32 truncate text-sm font-semibold text-white">{user.name}</span>
          <span className="flex items-center gap-1 text-[11px] text-slate-400"><span className="live-dot !h-1.5 !w-1.5" />Online</span>
        </span>
      </summary>
      <div className="card absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden py-1 shadow-2xl">
        <Link href={`/players/${user.handle}`} className="menu-item">{t("nav_profile")}</Link>
        <Link href="/account" className="menu-item">{L("Účet a propojené účty", "Účet a prepojené účty", "Account & linked accounts")}</Link>
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
      <button className="btn py-2">{t("login")}</button>
    </form>
  );

  return (
    <TopNav tabs={tabs} logo={<Logo />} drawer={<Sidebar />} menuLabel={L("Menu", "Menu", "Menu")}>
      {search}
      {palette}
      {bell}
      {langs}
      {account}
    </TopNav>
  );
}
