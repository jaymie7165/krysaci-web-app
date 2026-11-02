import type { Locale } from "@/lib/i18n";

/** "25 min", "1 h 12 min" (od `since` do teď). */
export function sinceText(since: number | undefined, locale: Locale): string | null {
  if (!since) return null;
  const min = Math.max(0, Math.round((Date.now() - since) / 60000));
  if (min < 1) return locale === "en" ? "just started" : "právě začal";
  return minText(min);
}

export function minText(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 && h < 10 ? `${h} h ${min % 60} min` : `${h} h`;
}

/** Celkový čas v sekundách ("12 h", "45 min"). */
export function totalText(sec: number | undefined, locale: Locale): string | null {
  if (!sec || sec < 600) return null; // méně než 10 minut neukazujeme
  const label = locale === "en" ? "total" : "celkem";
  return `${label} ${minText(Math.round(sec / 60))}`;
}
