import Link from "next/link";
import { db } from "@/lib/db";
import { getT, pick } from "@/lib/i18n";
import LolSearch from "@/components/LolSearch";

export const metadata = { title: "Statistiky" };

export default async function LookupPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; q?: string; error?: string }>;
}) {
  const { game = "lol", q = "", error } = await searchParams;
  const { locale } = await getT();
  const isVal = game === "valorant";

  const players =
    isVal && q.trim()
      ? await db.linkedAccount.findMany({
          where: { provider: "riot", verified: true, shareValorant: true, displayName: { contains: q.trim(), mode: "insensitive" } },
          include: { user: true },
          take: 12,
        })
      : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">{pick(locale, "Statistiky hráčů", "Štatistiky hráčov", "Player stats")}</h1>
        <p className="mt-2 max-w-2xl text-slate-400">
          {pick(
            locale,
            "Najdi kohokoliv v League of Legends nebo se podívej na Valorant profily hráčů, kteří je tady sdílejí.",
            "Nájdi hocikoho v League of Legends alebo sa pozri na Valorant profily hráčov, ktorí ich tu zdieľajú.",
            "Look up any League of Legends player, or browse Valorant profiles of players who share them here."
          )}
        </p>
      </div>

      <div className="flex gap-2" role="tablist">
        {[
          ["lol", "League of Legends"],
          ["valorant", "VALORANT"],
        ].map(([k, label]) => (
          <Link
            key={k}
            href={`/lookup?game=${k}`}
            role="tab"
            aria-selected={game === k}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              game === k ? "bg-accent text-white" : "bg-ink-800 text-slate-300 hover:text-white"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {error === "format" && (
        <p className="rounded-xl border border-ember/40 bg-ember/10 p-3 text-sm text-ember">
          {pick(locale, "Zadej Riot ID ve tvaru Jmeno#TAG.", "Zadaj Riot ID v tvare Meno#TAG.", "Enter a Riot ID like Name#TAG.")}
        </p>
      )}

      {!isVal ? (
        <LolSearch locale={locale} />
      ) : (
        <div className="space-y-5">
          <form className="flex max-w-2xl gap-2">
            <input type="hidden" name="game" value="valorant" />
            <input
              name="q"
              defaultValue={q}
              placeholder={pick(locale, "Jméno hráče", "Meno hráča", "Player name")}
              aria-label={pick(locale, "Jméno hráče", "Meno hráča", "Player name")}
              className="input flex-1"
            />
            <button className="btn">{pick(locale, "Hledat", "Hľadať", "Search")}</button>
          </form>
          <p className="max-w-2xl rounded-xl border border-ink-600 bg-ink-800 p-4 text-sm text-slate-400">
            {pick(
              locale,
              "Valorant data se zobrazují jen hráčům, kteří si propojili Riot účet na Play Haven a výslovně zapnuli sdílení. Nikoho cizího dohledat nejde.",
              "Valorant dáta sa zobrazujú len hráčom, ktorí si prepojili Riot účet na Play Haven a výslovne zapli zdieľanie. Nikoho cudzieho vyhľadať nejde.",
              "Valorant data is only shown for players who linked their Riot account on Play Haven and turned sharing on. You can't look up strangers."
            )}
          </p>
          {q.trim() && players.length === 0 && (
            <p className="text-slate-500">{pick(locale, "Nikdo takový nesdílí Valorant profil.", "Nikto taký nezdieľa Valorant profil.", "Nobody by that name shares a Valorant profile.")}</p>
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {players.map((a) => (
              <li key={a.id}>
                <Link href={`/players/${a.user.handle}`} className="card flex items-center gap-3 p-3 transition hover:shadow-glow">
                  {a.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.avatarUrl} alt="" className="h-10 w-10 rounded-xl" />
                  ) : (
                    <span className="h-10 w-10 rounded-xl bg-ink-600" />
                  )}
                  <span>
                    <span className="block font-semibold text-bone">{a.displayName}</span>
                    <span className="block text-xs text-slate-400">@{a.user.handle}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
