import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import AutoRefresh from "@/components/AutoRefresh";
import { getT } from "@/lib/i18n";
import { getTheme } from "@/lib/theme";
import Sidebar from "@/components/Sidebar";

// Stránky čtou data z databáze, nechceme je předgenerovat při buildu.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Play Haven – komunita hráčů CZ/SK", template: "%s · Play Haven" },
  description: "Profily, statistiky, turnaje, customky, hledání spoluhráčů a podpora pro hráče z Česka a Slovenska.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { t, locale } = await getT();
  const theme = await getTheme();
  return (
    <html lang={locale} data-theme={theme}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Nav />
        <AutoRefresh />
        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] overflow-y-auto border-r border-ink-600/40 px-4 py-4 lg:block">
            <Sidebar />
          </aside>
          <main className="min-h-[75vh] min-w-0 px-4 py-6 lg:px-8 lg:py-8 2xl:px-12">
            <div className="mx-auto max-w-[1760px]">{children}</div>
          </main>
        </div>
        <footer className="border-t border-ink-600/50">
          <div className="space-y-2 px-4 py-8 text-xs leading-relaxed text-slate-500 lg:pl-[272px] lg:pr-8 2xl:pr-12">
            <p>{t("footer")} · build 2026-10-30 v6</p>
            <p className="flex gap-4">
              <a href="/legal/terms" className="hover:text-slate-300">{locale === "en" ? "Terms" : "Podmínky"}</a>
              <a href="/legal/privacy" className="hover:text-slate-300">{locale === "en" ? "Privacy" : "Soukromí"}</a>
              <a href="/legal/cookies" className="hover:text-slate-300">Cookies</a>
            </p>
            <p className="max-w-3xl">
              Play Haven isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games
              or anyone officially involved in producing or managing Riot Games properties. Riot Games and all
              associated properties are trademarks or registered trademarks of Riot Games, Inc. Steam is a trademark
              of Valve Corporation.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
