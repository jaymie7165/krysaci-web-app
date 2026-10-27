import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { getT } from "@/lib/i18n";

// Stránky čtou data z databáze, nechceme je předgenerovat při buildu.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Krysáci – komunita hráčů CZ/SK", template: "%s · Krysáci" },
  description: "Vizitky, statistiky, turnaje, customky, LFG a podpora pro hráče z Česka a Slovenska.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { t, locale } = await getT();
  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Rajdhani:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Nav />
        <main className="mx-auto min-h-[70vh] max-w-6xl px-4 py-8">{children}</main>
        <footer className="border-t border-ink-600/60 py-8 text-center text-sm text-slate-500">
          {t("footer")}
        </footer>
      </body>
    </html>
  );
}
