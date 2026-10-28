/**
 * Převede hodnotu z <input type="datetime-local"> (např. "2026-10-30T19:00"), která je v pražském čase,
 * na správný okamžik. Server na Railway běží v UTC, takže prosté `new Date(str)` by čas posunulo.
 */
export function pragueToDate(local: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return new Date(NaN);
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const offset = (t: number) => {
    const parts = fmt.formatToParts(new Date(t));
    const g = (k: string) => Number(parts.find((p) => p.type === k)!.value);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - t;
  };
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let t = guess - offset(guess);
  t = guess - offset(t); // druhé přiblížení kvůli přechodu na letní/zimní čas
  return new Date(t);
}
