import { auth } from "@/lib/auth";
import { getT, pick } from "@/lib/i18n";
import SideNav, { type SideSection } from "./SideNav";

/** Obsah levého menu (stejný pro desktop i mobilní výsuvné menu). */
export default async function Sidebar() {
  const { t, locale } = await getT();
  const user = (await auth())?.user;
  const L = (cs: string, sk: string, en: string) => pick(locale, cs, sk, en);
  const sections: SideSection[] = [
    { links: [{ href: "/", label: L("Domů", "Domov", "Home"), icon: "home" }, { href: "/now", label: L("Co se děje teď", "Čo sa deje teraz", "Happening now"), icon: "pulse" }] },
    {
      title: L("Komunita", "Komunita", "Community"),
      links: [
        { href: "/lfg", label: "LFG", icon: "users" },
        { href: "/live", label: L("Živé hry", "Živé hry", "Live games"), icon: "live" },
        { href: "/players", label: t("nav_players"), icon: "users" },
        { href: "/customs", label: t("nav_customs"), icon: "game" },
        ...(user ? [{ href: "/friends", label: t("nav_friends"), icon: "users" }] : []),
        { href: "/teams", label: L("Týmy", "Tímy", "Teams"), icon: "shield" },
      ],
    },
    {
      title: L("Hry", "Hry", "Games"),
      links: [
        { href: "/games", label: L("Všechny hry", "Všetky hry", "All games"), icon: "game" },
        { href: "/lookup", label: L("Statistiky hráčů", "Štatistiky hráčov", "Player stats"), icon: "search" },
        ...(user ? [{ href: `/players/${user.handle}`, label: L("Moje hry", "Moje hry", "My games"), icon: "star" }] : []),
      ],
    },
    {
      title: L("Soutěže", "Súťaže", "Compete"),
      links: [
        { href: "/tournaments", label: t("nav_tournaments"), icon: "trophy" },
        { href: "/pickems", label: "Pickems", icon: "star" },
        { href: "/leaderboards", label: t("nav_leaderboards"), icon: "trophy" },
        { href: "/vote", label: t("nav_vote"), icon: "star" },
      ],
    },
    {
      title: "Esport",
      links: [
        { href: "/esports", label: L("Přehled", "Prehľad", "Overview"), icon: "trophy", tone: "gold" },
        { href: "/esports?game=lol", label: "League of Legends", icon: "game" },
        { href: "/esports?game=valorant", label: "VALORANT", icon: "game" },
      ],
    },
    { title: L("Web", "Web", "Site"), links: [{ href: "/news", label: L("Novinky", "Novinky", "News"), icon: "news" }, ...(user?.role === "ADMIN" ? [{ href: "/admin", label: "Admin", icon: "admin" }] : [])] },
  ];
  return <SideNav sections={sections} />;
}
