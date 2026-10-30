/** Pomocné funkce pro single-elimination pavouk. */
export type Part = { ref: string; name: string };
export type NewMatch = {
  round: number;
  position: number;
  refA: string | null;
  refB: string | null;
  nameA: string | null;
  nameB: string | null;
};

export function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function roundsFor(n: number) {
  let size = 2;
  while (size < n) size *= 2;
  return { size, rounds: Math.log2(size) };
}

/** Vytvoří všechny zápasy pavouku. Volné losy (bye) jsou jen v 1. kole a mají prázdný jeden slot. */
export function buildMatches(parts: Part[]): NewMatch[] {
  const { size, rounds } = roundsFor(parts.length);
  const pairs = size / 2;
  const seeded = shuffle(parts);
  const out: NewMatch[] = [];
  for (let k = 0; k < pairs; k++) {
    const a = seeded[k] ?? null;
    const b = seeded[pairs + k] ?? null;
    out.push({ round: 1, position: k, refA: a?.ref ?? null, refB: b?.ref ?? null, nameA: a?.name ?? null, nameB: b?.name ?? null });
  }
  for (let r = 2; r <= rounds; r++) {
    for (let k = 0; k < size / 2 ** r; k++) out.push({ round: r, position: k, refA: null, refB: null, nameA: null, nameB: null });
  }
  return out;
}

export function roundName(round: number, rounds: number, locale: string) {
  const left = rounds - round;
  const cs = locale !== "en";
  if (left === 0) return cs ? "Finále" : "Final";
  if (left === 1) return cs ? "Semifinále" : "Semifinals";
  if (left === 2) return cs ? "Čtvrtfinále" : "Quarterfinals";
  return cs ? `${round}. kolo` : `Round ${round}`;
}

type Owners = {
  entries: { id: string; userId: string }[];
  teams: { id: string; entries: { userId: string }[] }[];
};

/** ID hráčů, které za sebe reprezentuje účastník pavouku ("e:<entryId>" nebo "t:<teamId>"). */
export function usersOf(t: Owners, ref: string | null): string[] {
  if (!ref) return [];
  const [kind, id] = ref.split(":");
  if (kind === "e") return t.entries.filter((e) => e.id === id).map((e) => e.userId);
  return t.teams.find((x) => x.id === id)?.entries.map((e) => e.userId) ?? [];
}
