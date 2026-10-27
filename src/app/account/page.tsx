import Link from "next/link";
import { auth, signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, pick } from "@/lib/i18n";
import { DEFAULT_PLATFORM, PLATFORMS, profileIconUrl } from "@/lib/riot";
import { checkRiotVerify, linkRiot, setValorantShare, startRiotVerify, unlinkAccount } from "./actions";

export const metadata = { title: "Propojené účty" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const { t, locale } = await getT();
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-4xl font-bold">{pick(locale, "Propojené účty", "Prepojené účty", "Linked accounts")}</h1>
        <p className="text-slate-400">{t("loginRequired")}</p>
        <form
          action={async () => {
            "use server";
            await signIn("discord", { redirectTo: "/account" });
          }}
        >
          <button className="btn">{t("login")}</button>
        </form>
      </div>
    );
  }

  const accounts = await db.linkedAccount.findMany({ where: { userId: session.user.id } });
  const steam = accounts.find((a) => a.provider === "steam");
  const riot = accounts.find((a) => a.provider === "riot");

  const verifyIconUrl = riot?.verifyIcon != null ? await profileIconUrl(riot.verifyIcon).catch(() => null) : null;

  const errors: Record<string, string> = {
    steam_failed: pick(locale, "Přihlášení přes Steam se nepovedlo. Zkus to znovu.", "Prihlásenie cez Steam sa nepodarilo. Skús to znova.", "Steam sign-in failed. Please try again."),
    steam_taken: pick(locale, "Tenhle Steam účet už je propojený s jiným hráčem.", "Tento Steam účet je už prepojený s iným hráčom.", "This Steam account is already linked to another player."),
    riot_format: pick(locale, "Zadej Riot ID ve tvaru Jmeno#TAG.", "Zadaj Riot ID v tvare Meno#TAG.", "Enter a Riot ID like Name#TAG."),
    riot_notfound: pick(locale, "Takový Riot účet jsem nenašel. Zkontroluj Riot ID a server.", "Taký Riot účet som nenašiel. Skontroluj Riot ID a server.", "No such Riot account. Check the Riot ID and server."),
    riot_taken: pick(locale, "Tenhle Riot účet už je propojený s jiným hráčem.", "Tento Riot účet je už prepojený s iným hráčom.", "This Riot account is already linked to another player."),
    riot_nokey: pick(locale, "Propojení Riot účtu zatím není zapnuté (chybí RIOT_API_KEY).", "Prepojenie Riot účtu zatiaľ nie je zapnuté (chýba RIOT_API_KEY).", "Riot linking isn't enabled yet (RIOT_API_KEY missing)."),
    riot_key: pick(locale, "Riot klíč je neplatný nebo vypršel. Dej vědět správci.", "Riot kľúč je neplatný alebo vypršal. Daj vedieť správcovi.", "The Riot key is invalid or expired. Tell an admin."),
    riot_busy: pick(locale, "Riot má moc dotazů. Zkus to za minutu.", "Riot má príliš veľa dotazov. Skús to o minútu.", "Riot is rate limited. Try again in a minute."),
    verify_wrong_icon: pick(locale, "Ikona v LoL zatím nesedí. Nastav přesně tu zobrazenou, počkej pár vteřin a zkus to znovu.", "Ikona v LoL zatiaľ nesedí. Nastav presne tú zobrazenú, počkaj pár sekúnd a skús to znova.", "The LoL icon doesn't match yet. Set exactly the one shown, wait a few seconds and try again."),
    riot_failed: pick(locale, "Riot teď neodpovídá. Zkus to za chvíli.", "Riot teraz neodpovedá. Skús to o chvíľu.", "Riot isn't responding. Try again shortly."),
  };
  const oks: Record<string, string> = {
    steam: pick(locale, "Steam je propojený.", "Steam je prepojený.", "Steam linked."),
    riot: pick(locale, "Riot účet je propojený.", "Riot účet je prepojený.", "Riot account linked."),
    verified: pick(locale, "Riot účet je ověřený.", "Riot účet je overený.", "Riot account verified."),
    valorant: pick(locale, "Nastavení uloženo.", "Nastavenie uložené.", "Settings saved."),
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-4xl font-bold">{pick(locale, "Propojené účty", "Prepojené účty", "Linked accounts")}</h1>
        <p className="mt-2 text-slate-400">
          {pick(
            locale,
            "Propoj si herní účty a ostatní uvidí tvůj Steam nick, rank v LoL i Valorantu přímo na tvém profilu.",
            "Prepoj si herné účty a ostatní uvidia tvoj Steam nick, rank v LoL aj Valorante priamo na tvojom profile.",
            "Link your game accounts so others can see your Steam name and LoL and Valorant rank on your profile."
          )}
        </p>
      </div>

      {error && errors[error] && (
        <p role="alert" className="rounded-xl border border-ember/40 bg-ember/10 p-3 text-sm text-ember">{errors[error]}</p>
      )}
      {ok && oks[ok] && (
        <p role="status" className="rounded-xl border border-pulse/40 bg-pulse/10 p-3 text-sm text-pulse">{oks[ok]}</p>
      )}

      {/* Discord */}
      <section className="card flex items-center gap-4 p-5">
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="h-12 w-12 rounded-xl" />
        ) : (
          <span className="h-12 w-12 rounded-xl bg-ink-600" />
        )}
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Discord</h2>
          <p className="text-sm text-slate-400">{session.user.name}</p>
        </div>
        <span className="badge text-pulse">{pick(locale, "Propojeno", "Prepojené", "Linked")}</span>
      </section>

      {/* Steam */}
      <section className="card space-y-4 p-5">
        <div className="flex items-center gap-4">
          {steam?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={steam.avatarUrl} alt="" className="h-12 w-12 rounded-xl" />
          ) : (
            <span className="h-12 w-12 rounded-xl bg-ink-600" />
          )}
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Steam</h2>
            <p className="text-sm text-slate-400">
              {steam ? steam.displayName : pick(locale, "Ukáže se tvůj Steam nick a naposledy hrané hry.", "Ukáže sa tvoj Steam nick a naposledy hrané hry.", "Shows your Steam name and recently played games.")}
            </p>
          </div>
          {steam ? (
            <form action={unlinkAccount.bind(null, "steam")}>
              <button className="btn-ghost">{pick(locale, "Odpojit", "Odpojiť", "Unlink")}</button>
            </form>
          ) : (
            <a href="/api/connect/steam" className="btn">{pick(locale, "Propojit Steam", "Prepojiť Steam", "Link Steam")}</a>
          )}
        </div>
        {steam && (
          <p className="text-xs text-slate-500">
            {pick(
              locale,
              "Naposledy hrané hry se ukážou jen tehdy, když máš na Steamu veřejný profil a veřejné herní údaje.",
              "Naposledy hrané hry sa ukážu len vtedy, keď máš na Steame verejný profil a verejné herné údaje.",
              "Recently played games only show if your Steam profile and game details are public."
            )}
          </p>
        )}
      </section>

      {/* Riot */}
      <section className="card space-y-4 p-5">
        <div className="flex items-center gap-4">
          {riot?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={riot.avatarUrl} alt="" className="h-12 w-12 rounded-xl" />
          ) : (
            <span className="h-12 w-12 rounded-xl bg-ink-600" />
          )}
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Riot Games (LoL, VALORANT)</h2>
            <p className="text-sm text-slate-400">
              {riot
                ? `${riot.displayName}, ${PLATFORMS[riot.region ?? ""]?.label ?? riot.region}`
                : pick(locale, "Propoj Riot ID a uvidíš tady statistiky z LoL.", "Prepoj Riot ID a uvidíš tu štatistiky z LoL.", "Link your Riot ID to see your LoL stats here.")}
            </p>
          </div>
          {riot && (
            <form action={unlinkAccount.bind(null, "riot")}>
              <button className="btn-ghost">{pick(locale, "Odpojit", "Odpojiť", "Unlink")}</button>
            </form>
          )}
        </div>

        {riot ? (
          <>
            {riot.verified ? (
              <>
                <p className="text-xs text-pulse">
                  {pick(locale, "Účet je ověřený.", "Účet je overený.", "Account verified.")}
                </p>
                <form action={setValorantShare} className="flex flex-wrap items-center gap-3 rounded-xl bg-ink-900 p-3">
                  <label className="flex flex-1 items-start gap-3 text-sm text-slate-300">
                    <input type="checkbox" name="shareValorant" defaultChecked={riot.shareValorant} className="mt-1 h-4 w-4 accent-violet-500" />
                    <span>
                      {pick(
                        locale,
                        "Ukázat můj Valorant rank ostatním hráčům na mém profilu",
                        "Ukázať môj Valorant rank ostatným hráčom na mojom profile",
                        "Show my Valorant rank to other players on my profile"
                      )}
                    </span>
                  </label>
                  <button className="btn-ghost">{t("save")}</button>
                </form>
              </>
            ) : (
              <div className="space-y-3 rounded-xl bg-ink-900 p-4">
                <p className="text-sm font-semibold text-bone">
                  {pick(locale, "Ověř, že je účet tvůj", "Over, že je účet tvoj", "Verify that the account is yours")}
                </p>
                {riot.verifyIcon == null ? (
                  <>
                    <p className="text-sm text-slate-400">
                      {pick(
                        locale,
                        "Dostaneš ikonu, kterou si na pár minut nastavíš v League of Legends. Tím dokážeš, že účet patří tobě. Valorant rank se ukazuje jen u ověřených účtů.",
                        "Dostaneš ikonu, ktorú si na pár minút nastavíš v League of Legends. Tým dokážeš, že účet patrí tebe. Valorant rank sa ukazuje len pri overených účtoch.",
                        "You'll get an icon to set in League of Legends for a few minutes. That proves the account is yours. Valorant rank is only shown for verified accounts."
                      )}
                    </p>
                    <form action={startRiotVerify}>
                      <button className="btn">{pick(locale, "Začít ověření", "Začať overenie", "Start verification")}</button>
                    </form>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      {verifyIconUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={verifyIconUrl} alt="" className="h-16 w-16 rounded-xl border border-ink-600" />
                      )}
                      <p className="text-sm text-slate-300">
                        {pick(
                          locale,
                          "Nastav si v LoL (Profil, Změnit ikonu) tuhle ikonu, počkej pár vteřin a klikni na Zkontrolovat. Potom si můžeš vrátit původní.",
                          "Nastav si v LoL (Profil, Zmeniť ikonu) túto ikonu, počkaj pár sekúnd a klikni na Skontrolovať. Potom si môžeš vrátiť pôvodnú.",
                          "In LoL (Profile, Change icon) set this icon, wait a few seconds and press Check. You can switch back afterwards."
                        )}
                      </p>
                    </div>
                    <form action={checkRiotVerify}>
                      <button className="btn">{pick(locale, "Zkontrolovat", "Skontrolovať", "Check")}</button>
                    </form>
                  </>
                )}
              </div>
            )}
            <Link href={`/lol/${riot.region ?? DEFAULT_PLATFORM}/${encodeURIComponent(riot.gameName ?? "")}-${encodeURIComponent(riot.tagLine ?? "")}`} className="inline-block pt-1 text-sm text-accent-soft hover:text-white">
              {pick(locale, "Zobrazit moje LoL statistiky", "Zobraziť moje LoL štatistiky", "View my LoL stats")}
            </Link>
          </>
        ) : (
          <form action={linkRiot} className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <select name="platform" defaultValue={DEFAULT_PLATFORM} aria-label="Server" className="input sm:w-28">
                {Object.entries(PLATFORMS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <input name="riotId" required placeholder="Jaymie#HNZD" aria-label="Riot ID" className="input flex-1" />
              <button className="btn">{pick(locale, "Propojit", "Prepojiť", "Link")}</button>
            </div>
            <label className="flex items-start gap-3 text-sm text-slate-300">
              <input type="checkbox" name="shareValorant" className="mt-1 h-4 w-4 accent-violet-500" />
              <span>
                {pick(
                  locale,
                  "Ukázat můj Valorant rank ostatním hráčům na mém profilu (můžeš kdykoliv vypnout)",
                  "Ukázať môj Valorant rank ostatným hráčom na mojom profile (môžeš kedykoľvek vypnúť)",
                  "Show my Valorant rank to other players on my profile (you can turn it off anytime)"
                )}
              </span>
            </label>
          </form>
        )}
      </section>
    </div>
  );
}
