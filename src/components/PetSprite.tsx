import { ANCHORS, ITEM_FIT, ITEM_SIZE, PET_SIZE, STAGE_HEIGHT, type Gear, type Species } from "@/lib/pet";

type Mood = "sated" | "ok" | "hungry" | "starving" | "sleeping";

const WASH = ["", "saturate(.85) brightness(.97)", "saturate(.55) brightness(.9)", "grayscale(.8) brightness(.72)"];
const MOTION: Record<Species, string> = { dragon: "pet-breathe", cat: "pet-breathe", mushroom: "pet-sway", butterfly: "pet-float", bat: "pet-float" };

/**
 * Pet z obrázků (public/pets) s vrstvami doplňků. stage 0 až 4, `penalty` zhoršuje vzhled (bledne, hrbí se),
 * spící pet je ztmavený se zzz. Čtverec `size` px, pet stojí na jeho spodní hraně.
 */
export default function PetSprite({
  species, stage, mood, penalty = 0, gear = {}, size = 220,
}: {
  species: Species; stage: number; mood: Mood; penalty?: number; gear?: Gear; size?: number;
}) {
  const st = Math.max(0, Math.min(4, stage));
  const [pw, ph] = PET_SIZE[species][st];
  const a = ANCHORS[species][st];
  const sleeping = mood === "sleeping";
  const h = STAGE_HEIGHT[st];
  const filter = [WASH[penalty] ?? "", sleeping ? "brightness(.7) saturate(.7)" : ""].filter(Boolean).join(" ") || undefined;
  const motion = sleeping ? "pet-sleep" : mood === "sated" ? "pet-hop" : mood === "hungry" || mood === "starving" ? "pet-droop" : MOTION[species];
  const img = (src: string, style: React.CSSProperties, cls = "") => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" draggable={false} className={`pointer-events-none absolute select-none ${cls}`} style={style} />
  );
  const item = (key: string, w: number, style: React.CSSProperties, cls = "") => {
    const [iw, ih] = ITEM_SIZE[key];
    return img(`/pets/items/${key}.webp`, { width: `${w * 100}%`, aspectRatio: `${iw}/${ih}`, ...style }, cls);
  };

  const fit = (k?: string) => (k ? ITEM_FIT[k] ?? { scale: 1 } : { scale: 1 });
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="absolute bottom-0 left-1/2 h-[7%] w-[55%] -translate-x-1/2 rounded-[50%] bg-black/30 blur-md" />
      <div className="absolute bottom-0 left-1/2" style={{ height: `${h * 92}%`, aspectRatio: `${pw}/${ph}`, transform: "translateX(-50%)" }}>
        <div className={`absolute inset-0 ${motion}`} style={{ transformOrigin: "50% 100%" }}>
          {gear.aura && item(gear.aura, 1.05, { left: "50%", top: "50%", transform: "translate(-50%,-50%)", opacity: 0.9 }, "pet-aura")}
          {gear.back && item(gear.back, a.backW * fit(gear.back).scale, { left: "50%", top: `${a.backY * 100}%`, transform: "translate(-50%,-50%)" })}
          {img(`/pets/${species}-${st + 1}.webp`, { inset: 0, width: "100%", height: "100%", filter })}
          {gear.neck && item(gear.neck, a.neckW * fit(gear.neck).scale, { left: "50%", top: `${a.neckY * 100}%`, transform: "translate(-50%,-50%)" })}
          {gear.face && item(gear.face, a.headW * fit(gear.face).scale, { left: `${a.faceX * 100}%`, top: `${a.faceY * 100}%`, transform: "translate(-50%,-50%)" })}
          {gear.head && (() => {
            const f = fit(gear.head);
            return item(gear.head, a.headW * f.scale, { left: "50%", top: `${a.headTop * 100}%`, transform: `translate(-50%,-${(f.lift ?? 0.85) * 100}%)` }, gear.head === "halo" ? "pet-halo" : "");
          })()}
          {gear.orb && item(gear.orb, 0.34, { right: "-14%", bottom: "6%" }, "pet-orb")}
        </div>
      </div>
      {sleeping && (
        <div className="pointer-events-none absolute right-[14%] top-[10%] flex gap-1 font-extrabold text-sky-200">
          <span className="pet-zzz text-lg">z</span><span className="pet-zzz text-2xl [animation-delay:.6s]">Z</span><span className="pet-zzz text-3xl [animation-delay:1.2s]">Z</span>
        </div>
      )}
      {mood === "sated" && (
        <div className="pointer-events-none absolute left-1/2 top-[6%] -translate-x-1/2 text-xl">
          <span className="pet-hearts inline-block">💗</span><span className="pet-hearts inline-block [animation-delay:.7s]">💗</span>
        </div>
      )}
      {(mood === "starving") && <span className="pointer-events-none absolute left-[18%] top-[22%] text-xl pet-bob">💧</span>}
    </div>
  );
}
