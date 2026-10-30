import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import AutoRefresh from "@/components/AutoRefresh";
import { getT } from "@/lib/i18n";

// Stránky čtou data z databáze, nechceme je předgenerovat při buildu.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Play Haven – komunita hráčů CZ/SK", template: "%s · Play Haven" },
  description: "Profily, statistiky, turnaje, customky, hledání spoluhráčů a podpora pro hráče z Česka a Slovenska.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { t, locale } = await getT();
  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Figtree:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Nav />
        <AutoRefresh />
        <main className="mx-auto min-h-[75vh] max-w-7xl px-4 py-8 lg:px-8 lg:py-10">{children}</main>
        <footer className="border-t border-ink-600/50">
          <div className="mx-auto max-w-7xl space-y-2 px-4 py-8 text-xs leading-relaxed text-slate-500 lg:px-8">
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
