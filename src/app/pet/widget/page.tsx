import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, pick } from "@/lib/i18n";
import PetSprite from "@/components/PetSprite";
import { STAGE_NAMES, asSpecies, bgUrl, condition, levelFromXp, parseGear, shownStage } from "@/lib/pet";
import { feedPetWidget } from "../actions";

export const metadata = { title: "Pet" };

/** Malé okno peta pro plochu (aplikace ho otevře z lišty). Překryje celou stránku. */
export default async function PetWidget() {
  const s = await auth();
  const { locale } = await getT();
  const li = locale === "cs" ? 0 : locale === "sk" ? 1 : 2;
  const pet = s?.user?.id ? await db.pet.findUnique({ where: { userId: s.user.id } }) : null;
  const wrap = "fixed inset-0 z-[100] flex flex-col overflow-hidden bg-ink-950";
  if (!pet) {
    return (
      <div className={`${wrap} items-center justify-center gap-3 p-4 text-center`}>
        <p className="text-sm text-slate-300">{pick(locale, "Ještě nemáš peta. Vyber si ho na webu.", "Ešte nemáš peta. Vyber si ho na webe.", "You have no pet yet. Pick one on the site.")}</p>
        <a href="/pet" className="btn">Pet</a>
      </div>
    );
  }
  const species = asSpecies(pet.species);
  const level = levelFromXp(pet.xp);
  const c = condition(pet.lastFedAt);
  const stage = shownStage(level, c.penalty);
  return (
    <div className={wrap}>
      <div className="relative flex flex-1 items-end justify-center pb-2" style={{ backgroundImage: `url(${bgUrl(species)})`, backgroundSize: "cover", backgroundPosition: "bottom", WebkitAppRegion: "drag" } as React.CSSProperties}>
        <PetSprite species={species} stage={stage} mood={c.mood} penalty={c.penalty} gear={parseGear(pet.gear)} size={230} />
        <p className="absolute left-2 top-2 rounded-lg bg-ink-950/70 px-2 py-1 text-xs font-bold text-white">{pet.name} · {STAGE_NAMES[species][stage][li]} · {level}</p>
      </div>
      <div className="flex items-center justify-between gap-2 bg-ink-900 p-2 text-sm">
        <span className="text-slate-300">🍖 {pet.treats} · 🪙 {pet.coins}</span>
        <form action={feedPetWidget}><button className="btn px-3 py-1.5 text-xs" disabled={pet.treats < 1}>{pick(locale, "Nakrmit", "Nakŕmiť", "Feed")}</button></form>
      </div>
    </div>
  );
}
