import { pick, type Locale } from "@/lib/i18n";

/** Zpráva nad obsahem stránky. Akce na serveru se vrací s ?msg=kód. */
const MSG: Record<string, { ok: boolean; t: [string, string, string] }> = {
  sent: { ok: true, t: ["Žádost o přátelství odeslána.", "Žiadosť o priateľstvo odoslaná.", "Friend request sent."] },
  accepted: { ok: true, t: ["Teď jste přátelé.", "Teraz ste priatelia.", "You are now friends."] },
  already: { ok: false, t: ["Tohle už je tvůj kamarád.", "Toto už je tvoj kamarát.", "You're already friends."] },
  pending: { ok: false, t: ["Žádost už čeká na potvrzení.", "Žiadosť už čaká na potvrdenie.", "A request is already pending."] },
  self: { ok: false, t: ["Sám sebe přidat nejde.", "Seba pridať nejde.", "You can't add yourself."] },
  notfound: { ok: false, t: ["Hráče jsem nenašel. Hledej podle jména nebo @handlu, hráč se na webu musí aspoň jednou přihlásit.", "Hráča som nenašiel. Hľadaj podľa mena alebo @handlu, hráč sa na webe musí aspoň raz prihlásiť.", "Player not found. Use their name or @handle, they must have signed in at least once."] },
  closed: { ok: false, t: ["Přihlašování už je uzavřené.", "Prihlasovanie je už uzavreté.", "Registration is closed."] },
  full: { ok: false, t: ["Je plno.", "Je plno.", "It's full."] },
  solo: { ok: false, t: ["Tohle je turnaj pro jednotlivce, týmy tu nejsou.", "Toto je turnaj pre jednotlivcov, tímy tu nie sú.", "This is a solo tournament, teams aren't used."] },
  teamname: { ok: false, t: ["Název týmu musí mít aspoň 2 znaky.", "Názov tímu musí mať aspoň 2 znaky.", "Team name needs at least 2 characters."] },
  teamtaken: { ok: false, t: ["Tým s tímto názvem už v turnaji je.", "Tím s týmto názvom už v turnaji je.", "A team with that name already exists."] },
  inteam: { ok: false, t: ["Už jsi v jiném týmu. Nejdřív se odhlas.", "Už si v inom tíme. Najprv sa odhlás.", "You're already in a team. Leave first."] },
  memberbusy: { ok: false, t: ["Někdo z uvedených hráčů už je v jiném týmu.", "Niekto z uvedených hráčov už je v inom tíme.", "One of the players is already in another team."] },
  teamfull: { ok: false, t: ["Tým je plný.", "Tím je plný.", "The team is full."] },
  teamok: { ok: true, t: ["Tým je přihlášený.", "Tím je prihlásený.", "Team registered."] },
  locked: { ok: false, t: ["Zápas už začal nebo skončil, tip nejde změnit.", "Zápas už začal alebo skončil, tip nejde zmeniť.", "The match has started or finished, picks are locked."] },
  ratelimit: { ok: false, t: ["Zpomal, děláš to moc rychle. Zkus to za pár minut.", "Spomaľ, robíš to príliš rýchlo. Skús to o pár minút.", "Slow down, you are doing that too fast. Try again in a few minutes."] },
  added: { ok: true, t: ["Hráč přidán.", "Hráč pridaný.", "Player added."] },
};

export default function Notice({ msg, locale }: { msg?: string; locale: Locale }) {
  const m = msg ? MSG[msg] : undefined;
  if (!m) return null;
  return (
    <p
      role={m.ok ? "status" : "alert"}
      className={`border p-3 text-sm ${m.ok ? "border-pulse/40 bg-pulse/10 text-pulse" : "border-ember/40 bg-ember/10 text-ember"}`}
    >
      {pick(locale, ...m.t)}
    </p>
  );
}
