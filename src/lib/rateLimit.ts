/**
 * Jednoduchý limit počtu akcí na hráče (v paměti procesu, stačí pro jednu instanci).
 * Vrací true, pokud je akce povolená.
 */
const hits = new Map<string, number[]>();

export function allow(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    hits.set(key, list);
    return false;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 20000) hits.clear();
  return true;
}
