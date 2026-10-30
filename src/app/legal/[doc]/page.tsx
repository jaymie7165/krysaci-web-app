import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n";

type Doc = { title: string; sections: [string, string][] };

const CONTACT = process.env.CONTACT_EMAIL || "kontakt přes ticket na webu";

function docs(locale: string): Record<string, Doc> {
  const cs = locale !== "en";
  return {
    terms: {
      title: cs ? "Podmínky používání" : "Terms of use",
      sections: cs
        ? [
            ["Co je Play Haven", "Play Haven je nekomerční komunitní web pro hráče z Česka a Slovenska. Používáním webu souhlasíš s těmito pravidly."],
            ["Chování", "Buď slušný. Zakázané je spamování, urážky, podvádění v turnajích, vydávání se za jiné osoby a zneužívání webu. Admini mohou účet omezit nebo zablokovat."],
            ["Obsah od hráčů", "Za obsah, který přidáš (profil, LFG, customky, tikety), odpovídáš ty. Admini ho mohou upravit nebo smazat."],
            ["Bez záruky", "Web je poskytován „tak jak je“. Statistiky pocházejí z cizích služeb (Riot, Steam) a nemusí být vždy přesné nebo dostupné."],
            ["Značky", "Play Haven není spojen s Riot Games ani Valve. Všechny značky patří jejich vlastníkům."],
          ]
        : [
            ["What Play Haven is", "Play Haven is a non-commercial community site for Czech and Slovak gamers. By using it you accept these rules."],
            ["Conduct", "Be decent. No spam, insults, cheating in tournaments, impersonation or abuse of the site. Admins may restrict or ban accounts."],
            ["User content", "You are responsible for what you add (profile, LFG, customs, tickets). Admins may edit or remove it."],
            ["No warranty", "The site is provided as is. Stats come from third-party services (Riot, Steam) and may be inaccurate or unavailable."],
            ["Trademarks", "Play Haven is not affiliated with Riot Games or Valve. All trademarks belong to their owners."],
          ],
    },
    privacy: {
      title: cs ? "Ochrana osobních údajů" : "Privacy policy",
      sections: cs
        ? [
            ["Správce", `Správcem údajů je provozovatel webu Play Haven (${CONTACT}).`],
            ["Jaké údaje ukládáme", "Při přihlášení přes Discord ukládáme Discord ID, uživatelské jméno a avatar. Dále to, co sám zadáš: bio, barvu profilu, propojené herní účty (Riot ID, Steam), tipy, přihlášky do turnajů, LFG a customek, přátele a tikety."],
            ["Proč", "Údaje používáme jen k provozu webu: profil, statistiky, turnaje, hledání spoluhráčů a podpora. Nic neprodáváme a nepoužíváme k reklamě."],
            ["Komu je předáváme", "Riot ID posíláme Riot API a Steam ID Steamu, abychom načetli tvoje statistiky. Web běží na hostingu Railway. Discord slouží k přihlášení."],
            ["Tvoje práva (GDPR)", "Můžeš kdykoliv stáhnout všechna svá data a smazat účet na stránce Účet. Smazání je trvalé. Opravu údajů uděláš v profilu, případně napiš do ticketu."],
            ["Jak dlouho", "Údaje držíme, dokud účet existuje. Po smazání účtu se odstraní i s vazbami; výjimkou je záznam akcí adminů (bez osobních dat hráče)."],
          ]
        : [
            ["Controller", `The controller is the operator of Play Haven (${CONTACT}).`],
            ["What we store", "On Discord sign-in we store your Discord ID, username and avatar, plus what you enter: bio, profile colour, linked game accounts (Riot ID, Steam), picks, tournament/LFG/custom entries, friends and tickets."],
            ["Why", "Only to run the site: profile, stats, tournaments, finding teammates and support. We do not sell data or use it for advertising."],
            ["Who receives it", "Your Riot ID is sent to the Riot API and Steam ID to Steam to load your stats. The site is hosted on Railway. Discord is used for sign-in."],
            ["Your rights (GDPR)", "You can download all your data and delete your account on the Account page at any time. Deletion is permanent. You can fix data in your profile or contact us via a ticket."],
            ["Retention", "Data is kept while your account exists. On deletion it is removed with its relations; the admin action log (without personal player data) is the exception."],
          ],
    },
    cookies: {
      title: cs ? "Cookies" : "Cookies",
      sections: cs
        ? [
            ["Jen nutné cookies", "Používáme pouze technické cookies: přihlášení (session) a volbu jazyka. Žádné reklamní ani sledovací cookies nepoužíváme, proto nepotřebuješ cookie lištu."],
          ]
        : [
            ["Essential only", "We only use technical cookies: sign-in session and language choice. No advertising or tracking cookies, so no cookie banner is needed."],
          ],
    },
  };
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  return { title: doc === "terms" ? "Podmínky" : doc === "privacy" ? "Soukromí" : "Cookies" };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const { locale } = await getT();
  const d = docs(locale)[doc];
  if (!d) notFound();
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">{d.title}</h1>
      {d.sections.map(([h, b]) => (
        <section key={h} className="card space-y-2 p-5">
          <h2 className="font-semibold">{h}</h2>
          <p className="text-sm leading-relaxed text-slate-300">{b}</p>
        </section>
      ))}
    </article>
  );
}
