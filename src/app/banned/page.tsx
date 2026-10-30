import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, pick } from "@/lib/i18n";

export const metadata = { title: "Účet omezen" };

export default async function Banned() {
  const { locale } = await getT();
  const s = await auth();
  const u = s?.user?.id ? await db.user.findUnique({ where: { id: s.user.id }, select: { banReason: true, bannedAt: true } }) : null;
  return (
    <div className="mx-auto max-w-xl space-y-3 py-10">
      <h1 className="text-2xl font-bold">{pick(locale, "Tvůj účet je omezený", "Tvoj účet je obmedzený", "Your account is restricted")}</h1>
      <p className="text-slate-300">
        {u?.bannedAt
          ? pick(locale, "Admin ti zablokoval možnost něco na webu měnit.", "Admin ti zablokoval možnosť niečo na webe meniť.", "An admin has blocked you from making changes on the site.")
          : pick(locale, "Tvůj účet není omezený.", "Tvoj účet nie je obmedzený.", "Your account is not restricted.")}
      </p>
      {u?.banReason && <p className="card p-4 text-sm text-slate-300">{u.banReason}</p>}
    </div>
  );
}
