import { pick, type Locale } from "@/lib/i18n";
import type { DData } from "@/lib/riot";

/** Odhad složení týmu podle typu šampionů (Data Dragon), ne podle itemů. */
export function comp(team: { championId: number }[], dd: DData) {
  let ad = 0, ap = 0, tanks = 0, known = 0;
  for (const p of team) {
    const c = dd.champs[String(p.championId)];
    if (!c) continue;
    known++;
    const t = c.info.attack + c.info.magic || 1;
    ad += c.info.attack / t;
    ap += c.info.magic / t;
    if (c.tags.includes("Tank") || c.info.defense >= 8) tanks++;
  }
  const total = ad + ap || 1;
  return { adShare: ad / total, apShare: ap / total, tanks, known };
}

export function advice(mine: ReturnType<typeof comp>, enemy: ReturnType<typeof comp>, locale: Locale) {
  const out: string[] = [];
  const e = (x: number) => Math.round(x * 100);
  if (enemy.known >= 2) {
    if (enemy.apShare >= 0.6)
      out.push(pick(locale, `Nepřátelé dávají hlavně magický damage (${e(enemy.apShare)} % AP). Magic resist se vyplatí dřív.`, `Nepriatelia dávajú hlavne magický damage (${e(enemy.apShare)} % AP). Magic resist sa oplatí skôr.`, `The enemy deals mostly magic damage (${e(enemy.apShare)}% AP). Magic resist pays off early.`));
    else if (enemy.adShare >= 0.6)
      out.push(pick(locale, `Nepřátelé dávají hlavně fyzický damage (${e(enemy.adShare)} % AD). Armor se vyplatí dřív.`, `Nepriatelia dávajú hlavne fyzický damage (${e(enemy.adShare)} % AD). Armor sa oplatí skôr.`, `The enemy deals mostly physical damage (${e(enemy.adShare)}% AD). Armor pays off early.`));
    else
      out.push(pick(locale, "Nepřátelský damage je vyvážený (AD i AP), nestačí jedna obrana. Stav podle toho, kdo je největší hrozba.", "Nepriateľský damage je vyvážený (AD aj AP), nestačí jedna obrana. Stavaj podľa toho, kto je najväčšia hrozba.", "Enemy damage is mixed (AD and AP), one resistance isn't enough. Build against the biggest threat."));
    if (enemy.tanks >= 2)
      out.push(pick(locale, `Nepřátelé mají ${enemy.tanks} tanky. Hodí se penetrace nebo procentuální damage.`, `Nepriatelia majú ${enemy.tanks} tankov. Hodí sa penetrácia alebo percentuálny damage.`, `The enemy has ${enemy.tanks} tanks. Penetration or percent damage helps.`));
  }
  if (mine.known >= 3) {
    if (mine.adShare >= 0.75)
      out.push(pick(locale, "Tvůj tým má skoro jen fyzický damage. Magický damage by hodně pomohl.", "Tvoj tím má takmer len fyzický damage. Magický damage by veľmi pomohol.", "Your team has almost only physical damage. Magic damage would help a lot."));
    else if (mine.apShare >= 0.75)
      out.push(pick(locale, "Tvůj tým má skoro jen magický damage. Fyzický damage by hodně pomohl.", "Tvoj tím má takmer len magický damage. Fyzický damage by veľmi pomohol.", "Your team has almost only magic damage. Physical damage would help a lot."));
    if (mine.tanks === 0)
      out.push(pick(locale, "V týmu zatím není žádný tank, chybí přední linie.", "V tíme zatiaľ nie je žiadny tank, chýba predná línia.", "No tank on your team yet, the front line is missing."));
  }
  return out;
}
