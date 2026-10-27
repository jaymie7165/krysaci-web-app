import { db } from "@/lib/db";

/**
 * Vrátí data z cache, pokud jsou čerství (ttl v sekundách). Jinak je načte funkcí `load`
 * a uloží. Když načtení selže a existuje stará kopie, vrátí se ta (lepší než chyba).
 */
export async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
  const row = await db.statCache.findUnique({ where: { key } }).catch(() => null);
  if (row && Date.now() - row.fetchedAt.getTime() < ttlSec * 1000) return row.data as T;
  try {
    const data = await load();
    await db.statCache
      .upsert({
        where: { key },
        update: { data: data as never, fetchedAt: new Date() },
        create: { key, data: data as never },
      })
      .catch(() => null);
    return data;
  } catch (e) {
    if (row) return row.data as T;
    throw e;
  }
}
