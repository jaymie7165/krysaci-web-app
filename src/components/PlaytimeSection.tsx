import { db } from "@/lib/db";
import { pick, type Locale } from "@/lib/i18n";
import { minText } from "@/lib/duration";

/** Čas ve hrách, který web zaznamenal (podle Discord aktivity). FiveM je rozepsaný po serverech. */
export default async function PlaytimeSection({ userId, locale }: { userId: string; locale: Locale }) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { showActivity: true } }).catch(() => null);
  if (!u?.showActivity) return null; // hráč si aktivitu vypnul
  const rows = await db.playTime.findMany({ where: { userId, seconds: { gte: 600 } }, orderBy: { seconds: "desc" }, take: 12 }).catch(() => []);
  if (rows.length === 0) return null;
  const max = rows[0].seconds;
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold">{pick(locale, "Čas ve hrách", "Čas v hrách", "Time in games")}</h2>
      <div className="card divide-y divide-ink-600/40">
        {rows.map((r: { id: string; gameName: string; seconds: number }) => (
          <div key={r.id} className="space-y-1.5 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-semibold text-white">{r.gameName}</span>
              <span className="num shrink-0 text-slate-300">{minText(Math.round(r.seconds / 60))}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, Math.round((r.seconds / max) * 100))}%` }} /></div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">{pick(locale, "Zaznamenáno od zapnutí sledování, z Discord aktivity.", "Zaznamenané od zapnutia sledovania, z Discord aktivity.", "Tracked since monitoring was enabled, from Discord activity.")}</p>
    </section>
  );
}
