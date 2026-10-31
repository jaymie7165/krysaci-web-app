import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, pick } from "@/lib/i18n";
import Notice from "@/components/Notice";
import PetSprite from "@/components/PetSprite";
import {
  BG_CSS, BG_SHOP, GAME_REWARD, SHOP, SLOTS, SLOT_LABEL, SPECIES, SPECIES_LABEL, STAGE_LEVELS, STAGE_NAMES, SLEEP_HOURS,
  asSpecies, condition, levelFromXp, parseGear, shownStage, stageFromLevel, xpForLevel,
} from "@/lib/pet";
import { syncPetGames } from "@/lib/petSync";
import { adoptPet, buyItem, equipBg, equipItem, feedPet } from "./actions";

export const metadata = { title: "Pet" };

export default async function PetPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const s = await auth();
  if (!s?.user?.id) redirect("/api/auth/signin");
  const uid = s.user.id;
  const { msg } = await searchParams;
  const { locale } = await getT();
  const li = locale === "cs" ? 0 : locale === "sk" ? 1 : 2;
  const L = (cs: string, sk: string, en: string) => pick(locale, cs, sk, en);

  let pet = await db.pet.findUnique({ where: { userId: uid } });
  if (!pet) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-3xl font-bold">{L("Vyber si peta", "Vyber si peta", "Choose your pet")}</h1>
        <p className="text-slate-300">{L("Pet roste, když hraješ. Za každou odehranou hru dostane pamlsky, XP a ty peníze na doplňky. Hry s lidmi z komunity dávají dvojnásobek. Když ho nekrmíš, jeho vzhled se zhoršuje.", "Pet rastie, keď hráš. Za každú odohranú hru dostane maškrty, XP a ty peniaze na doplnky. Hry s ľuďmi z komunity dávajú dvojnásobok. Keď ho nekŕmiš, jeho vzhľad sa zhoršuje.", "Your pet grows as you play. Every finished game gives treats, XP and coins for accessories. Games with community members give double. If you don't feed it, it gets worse-looking.")}</p>
        <Notice msg={msg} locale={locale} />
        <form action={adoptPet} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {SPECIES.map((sp, i) => (
              <label key={sp} className="card cursor-pointer space-y-2 p-4 text-center has-[:checked]:border-accent has-[:checked]:bg-accent/10">
                <input type="radio" name="species" value={sp} defaultChecked={i === 0} className="sr-only" />
                <div className="mx-auto w-fit"><PetSprite species={sp} stage={sp === "dragon" ? 1 : 1} mood="ok" size={170} /></div>
                <p className="font-bold text-white">{SPECIES_LABEL[sp][li]}</p>
                <p className="text-xs text-slate-400">{STAGE_NAMES[sp][0][li]} → {STAGE_NAMES[sp][4][li]}</p>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">{L("Jméno peta", "Meno peta", "Pet name")}</label>
              <input name="name" required minLength={2} maxLength={20} className="input w-64" placeholder="Ember" />
            </div>
            <button className="btn">{L("Adoptovat", "Adoptovať", "Adopt")}</button>
          </div>
        </form>
      </div>
    );
  }

  const sync = await syncPetGames(uid).catch(() => ({ gained: 0, error: "x" }));
  if (sync.gained > 0) pet = (await db.pet.findUnique({ where: { userId: uid } })) ?? pet;
  const [owned, games, riot] = await Promise.all([
    db.petItem.findMany({ where: { userId: uid } }),
    db.petGame.findMany({ where: { userId: uid, counted: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.linkedAccount.findFirst({ where: { userId: uid, provider: "riot" } }),
  ]);
  const have = new Set(owned.map((o) => o.key));
  const species = asSpecies(pet.species);
  const gear = parseGear(pet.gear);
  const level = levelFromXp(pet.xp);
  const baseStage = stageFromLevel(level);
  const cond = condition(pet.lastFedAt);
  const shown = shownStage(level, cond.penalty);
  const next = STAGE_LEVELS[baseStage + 1];
  const lvStart = xpForLevel(level), lvEnd = xpForLevel(level + 1);
  const pct = Math.round(((pet.xp - lvStart) / (lvEnd - lvStart)) * 100);
  const hoursLeft = Math.max(0, SLEEP_HOURS - cond.hours);
  const moodText = {
    sated: L("Spokojeně chroupe", "Spokojne chrúme", "Happily munching"),
    ok: L("V pohodě", "V pohode", "Doing fine"),
    hungry: L("Má hlad", "Je hladný", "Hungry"),
    starving: L("Je hodně hladový a chátrá", "Je veľmi hladný a chradne", "Very hungry and fading"),
    sleeping: L("Vyhladověl a spí. Nakrm ho.", "Vyhladol a spí. Nakŕm ho.", "Starved and asleep. Feed it."),
  }[cond.mood];

  return (
    <div className="space-y-6">
      <Notice msg={msg} locale={locale} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="card overflow-hidden">
          <div className="relative grid min-h-[380px] place-items-center" style={{ background: BG_CSS[pet.bg ?? "meadow"] }}>
            <PetSprite species={species} stage={shown} mood={cond.mood} penalty={cond.penalty} gear={gear} size={340} />
            <div className="absolute left-4 top-4 rounded-xl bg-ink-950/70 px-3 py-2 backdrop-blur">
              <p className="text-lg font-extrabold text-white">{pet.name}</p>
              <p className="text-xs text-slate-300">{STAGE_NAMES[species][shown][li]} · {L("úroveň", "úroveň", "level")} {level}</p>
            </div>
            {cond.penalty > 0 && (
              <p className="absolute bottom-3 left-1/2 w-[90%] -translate-x-1/2 rounded-lg bg-ember/80 px-3 py-1.5 text-center text-xs font-semibold text-white">
                {L("Zanedbaný pet vypadá hůř, než by měl. Nakrm ho a vzhled se vrátí.", "Zanedbaný pet vyzerá horšie, než by mal. Nakŕm ho a vzhľad sa vráti.", "A neglected pet looks worse than it should. Feed it to restore its look.")}
              </p>
            )}
          </div>
          <div className="space-y-4 p-5">
            <div>
              <div className="flex justify-between text-sm"><span className="text-slate-300">XP</span><span className="num text-white">{pet.xp}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} /></div>
              <p className="mt-1 text-xs text-slate-500">
                {L("Další úroveň za", "Ďalšia úroveň za", "Next level in")} {Math.max(0, lvEnd - pet.xp)} XP
                {next ? ` · ${L("další vzhled na úrovni", "ďalší vzhľad na úrovni", "next look at level")} ${next}` : ` · ${L("maximální vzhled", "maximálny vzhľad", "max look")}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-slate-300">{moodText}{!cond.sleeping && cond.hours >= 1 ? ` · ${L("nejedl", "nejedol", "not fed for")} ${Math.floor(cond.hours)} h` : ""}{cond.penalty > 0 && !cond.sleeping ? ` · ${L("do spánku", "do spánku", "sleeps in")} ${Math.ceil(hoursLeft)} h` : ""}</p>
              <form action={feedPet} className="ml-auto"><button className="btn" disabled={pet.treats < 1}>🍖 {L("Nakrmit", "Nakŕmiť", "Feed")} ({pet.treats})</button></form>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="card grid grid-cols-3 gap-3 p-4 text-center">
            <div><p className="num text-2xl text-white">{pet.treats}</p><p className="text-xs text-slate-400">{L("pamlsků", "maškŕt", "treats")}</p></div>
            <div><p className="num text-2xl text-gold">{pet.coins}</p><p className="text-xs text-slate-400">{L("mincí", "mincí", "coins")}</p></div>
            <div><p className="num text-2xl text-white">{level}</p><p className="text-xs text-slate-400">{L("úroveň", "úroveň", "level")}</p></div>
          </section>
          <section className="card space-y-2 p-4 text-sm text-slate-300">
            <h2 className="font-bold text-white">{L("Jak získat odměny", "Ako získať odmeny", "How to earn")}</h2>
            <p>🎮 {L(`Odehraná hra v LoLu: ${GAME_REWARD.treats} pamlsků, ${GAME_REWARD.xp} XP, ${GAME_REWARD.coins} mincí.`, `Odohraná hra v LoLe: ${GAME_REWARD.treats} maškŕt, ${GAME_REWARD.xp} XP, ${GAME_REWARD.coins} mincí.`, `A finished LoL game: ${GAME_REWARD.treats} treats, ${GAME_REWARD.xp} XP, ${GAME_REWARD.coins} coins.`)}</p>
            <p>🤝 {L("Hra s někým z komunity (přítel nebo spoluhráč z LFG, customky, turnaje) dává dvojnásobek XP a mincí, 5× denně.", "Hra s niekým z komunity (priateľ alebo spoluhráč z LFG, customky, turnaja) dáva dvojnásobok XP a mincí, 5× denne.", "A game with someone from the community (friend or teammate from LFG, customs, tournaments) gives double XP and coins, 5× a day.")}</p>
            {!riot?.verified && (
              <p className="rounded-lg bg-gold/10 p-2 text-gold">
                {L("Hry se počítají jen z ověřeného Riot účtu. ", "Hry sa počítajú len z overeného Riot účtu. ", "Games count only from a verified Riot account. ")}
                <Link href="/account" className="underline">{L("Ověřit účet", "Overiť účet", "Verify account")}</Link>
              </p>
            )}
            {sync.error && <p className="text-xs text-slate-500">{L("Riot teď neodpověděl, zkusím to znovu při dalším otevření.", "Riot teraz neodpovedal, skúsim to znova pri ďalšom otvorení.", "Riot didn't respond, will retry next time.")}</p>}
            {games.length > 0 && <p className="text-xs text-slate-500">{L("Započítané hry", "Započítané hry", "Counted games")}: {games.length}{games.some((g) => g.social) ? ` · ${games.filter((g) => g.social).length}× ${L("s komunitou", "s komunitou", "social")}` : ""}</p>}
          </section>
        </aside>
      </div>

      <section className="space-y-5">
        <h2 className="text-xl font-bold">{L("Obchod a skříň", "Obchod a skriňa", "Shop & wardrobe")}</h2>
        {SLOTS.map((slot) => (
          <div key={slot} className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">{SLOT_LABEL[slot][li]}</h3>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {SHOP.filter((it) => it.slot === slot).map((it) => {
                const got = have.has(it.key);
                const on = gear[slot] === it.key;
                return (
                  <div key={it.key} className={`card space-y-2 p-3 ${on ? "border-accent" : ""}`}>
                    <div className="grid h-24 place-items-center rounded-lg bg-ink-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/pets/items/${it.key}.webp`} alt="" className="max-h-20 max-w-[85%] object-contain" />
                    </div>
                    <p className="text-sm font-semibold text-white">{it.label[li]}</p>
                    {got ? (
                      <form action={equipItem.bind(null, slot, on ? "" : it.key)}><button className={on ? "btn-ghost w-full" : "btn w-full"}>{on ? L("Sundat", "Zložiť", "Remove") : L("Nasadit", "Nasadiť", "Equip")}</button></form>
                    ) : (
                      <form action={buyItem.bind(null, it.key)}><button className="btn-ghost w-full" disabled={pet!.coins < it.price}>🪙 {it.price}</button></form>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">{L("Pozadí", "Pozadie", "Background")}</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            {[{ key: "meadow", price: 0, label: ["Louka", "Lúka", "Meadow"] as [string, string, string] }, ...BG_SHOP].map((b) => {
              const got = b.key === "meadow" || have.has(b.key);
              const on = (pet!.bg ?? "meadow") === b.key;
              return (
                <div key={b.key} className={`card space-y-2 p-3 ${on ? "border-accent" : ""}`}>
                  <div className="h-16 rounded-lg" style={{ background: BG_CSS[b.key] }} />
                  <p className="text-sm font-semibold text-white">{b.label[li]}</p>
                  {got ? (
                    <form action={equipBg.bind(null, b.key)}><button className={on ? "btn-ghost w-full" : "btn w-full"} disabled={on}>{on ? L("Nasazeno", "Nasadené", "Active") : L("Nasadit", "Nasadiť", "Equip")}</button></form>
                  ) : (
                    <form action={buyItem.bind(null, b.key)}><button className="btn-ghost w-full" disabled={pet!.coins < b.price}>🪙 {b.price}</button></form>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
