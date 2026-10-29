import { db } from "@/lib/db";

/**
 * Bodování pickems:
 *  - správný vítěz zápasu: 10 b.
 *  - přesný výsledek série (u Bo3 a Bo5): +5 b.
 *  - outsider (vítěze tipovalo méně než 30 % hráčů, aspoň 5 tipů celkem): +5 b.
 *  - násobič fáze: základní část ×1, playoff/vyřazovací fáze ×1,5, semifinále ×1,5, finále ×2.
 */
export const POINTS = { winner: 10, exact: 5, underdog: 5 } as const;
export const UNDERDOG_SHARE = 0.3;
export const UNDERDOG_MIN_PICKS = 5;

export function stageMultiplier(stage: string | null | undefined) {
  const s = (stage ?? "").toLowerCase();
  if (/semi|polofin/.test(s)) return 1.5;
  if (/final/.test(s)) return 2;
  if (/playoff|knockout|bracket|quarter|vyřaz/.test(s)) return 1.5;
  return 1;
}

/** Všechny platné výsledky série pro daný formát, např. Bo3: A 2:0, A 2:1, B 1:2, B 0:2. */
export function seriesResults(bestOf: number) {
  const need = Math.ceil(bestOf / 2);
  const out: { winner: "A" | "B"; a: number; b: number }[] = [];
  for (let loser = 0; loser < need; loser++) out.push({ winner: "A", a: need, b: loser });
  for (let loser = 0; loser < need; loser++) out.push({ winner: "B", a: loser, b: need });
  return out;
}

type P = { winner: string; scoreA: number | null; scoreB: number | null };
type M = { bestOf: number; stage: string | null; scoreA: number | null; scoreB: number | null };

export function scorePick(p: P, m: M, underdog: boolean) {
  if (m.scoreA == null || m.scoreB == null || m.scoreA === m.scoreB) return null;
  const real = m.scoreA > m.scoreB ? "A" : "B";
  if (p.winner !== real) return 0;
  let pts: number = POINTS.winner;
  if (m.bestOf > 1 && p.scoreA === m.scoreA && p.scoreB === m.scoreB) pts += POINTS.exact;
  if (underdog) pts += POINTS.underdog;
  return Math.round(pts * stageMultiplier(m.stage));
}

/** Vyhodnotí tipy u dohraných zápasů. Bezpečné spouštět opakovaně. */
export async function settlePicks() {
  try {
    const open = await db.pick.findMany({
      where: { points: null, match: { status: "finished", scoreA: { not: null }, scoreB: { not: null } } },
      include: { match: true },
    });
    if (open.length === 0) return 0;
    const matchIds = [...new Set(open.map((p) => p.matchId))];
    const all = await db.pick.groupBy({ by: ["matchId", "winner"], where: { matchId: { in: matchIds } }, _count: true });
    const share = new Map<string, { A: number; B: number }>();
    for (const r of all) {
      const e = share.get(r.matchId) ?? { A: 0, B: 0 };
      e[r.winner as "A" | "B"] += r._count;
      share.set(r.matchId, e);
    }
    let n = 0;
    for (const p of open) {
      const s = share.get(p.matchId) ?? { A: 0, B: 0 };
      const total = s.A + s.B;
      const mine = p.winner === "A" ? s.A : s.B;
      const underdog = total >= UNDERDOG_MIN_PICKS && mine / total < UNDERDOG_SHARE;
      const pts = scorePick(p, p.match, underdog);
      if (pts == null) continue;
      await db.pick.update({ where: { id: p.id }, data: { points: pts } });
      n++;
    }
    return n;
  } catch {
    return 0;
  }
}
