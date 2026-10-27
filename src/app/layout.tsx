import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
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
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Figtree:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
          <Nav />
          <div className="min-w-0">
            <main className="mx-auto min-h-[75vh] max-w-6xl px-4 py-8 lg:px-10 lg:py-10">{children}</main>
            <footer className="max-w-3xl space-y-2 px-4 py-8 text-xs leading-relaxed text-slate-500 lg:px-10">
              <p>{t("footer")}</p>
              <p>
                Play Haven isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games
                or anyone officially involved in producing or managing Riot Games properties. Riot Games and all
                associated properties are trademarks or registered trademarks of Riot Games, Inc. Steam is a trademark
                of Valve Corporation.
              </p>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
