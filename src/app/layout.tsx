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
            <footer className="px-4 py-8 text-sm text-slate-500 lg:px-10">{t("footer")}</footer>
          </div>
        </div>
      </body>
    </html>
  );
}
