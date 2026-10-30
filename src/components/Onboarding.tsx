import Link from "next/link";
import { db } from "@/lib/db";
import { pick, type Locale } from "@/lib/i18n";
import { dismissOnboarding } from "@/app/actions";

/** Úvodní průvodce pro nového hráče: ukáže, co udělat dál. Zmizí po splnění nebo po zavření. */
export default async function Onboarding({ userId, locale }: { userId: string; locale: Locale }) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { onboardingDismissed: true, bio: true } });
  if (!u || u.onboardingDismissed) return null;
  const [linked, profiles, friends, joins] = await Promise.all([
    db.linkedAccount.count({ where: { userId } }),
    db.gameProfile.count({ where: { userId } }),
    db.friendship.count({ where: { OR: [{ requesterId: userId }, { addresseeId: userId }] } }),
    Promise.all([
      db.customEntry.count({ where: { userId } }),
      db.tournamentEntry.count({ where: { userId } }),
      db.lfgJoin.count({ where: { userId } }),
      db.lfgPost.count({ where: { authorId: userId } }),
    ]).then((a) => a.reduce((x, y) => x + y, 0)),
  ]);
  const L = (cs: string, sk: string, en: string) => pick(locale, cs, sk, en);
  const steps: { done: boolean; label: string; href: string }[] = [
    { done: linked > 0, label: L("Propoj Riot nebo Steam účet", "Prepoj Riot alebo Steam účet", "Link your Riot or Steam account"), href: "/account" },
    { done: profiles > 0, label: L("Přidej se do hry a vyplň herní jméno", "Pridaj sa do hry a vyplň herné meno", "Join a game and set your in-game name"), href: "/games" },
    { done: friends > 0, label: L("Přidej prvního kamaráda", "Pridaj prvého kamaráta", "Add your first friend"), href: "/friends" },
    { done: joins > 0, label: L("Zapoj se do customky, turnaje nebo LFG", "Zapoj sa do customky, turnaja alebo LFG", "Join a custom, tournament or LFG"), href: "/customs" },
    { done: !!u.bio, label: L("Napiš pár slov o sobě do profilu", "Napíš pár slov o sebe do profilu", "Write a few words in your profile"), href: "/account" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  return (
    <section className="card space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{L("Začni tady", "Začni tu", "Get started")} <span className="text-sm text-slate-400">({doneCount}/{steps.length})</span></h2>
        <form action={dismissOnboarding}><button className="text-xs text-slate-500 hover:text-slate-300">{L("Skrýt", "Skryť", "Dismiss")}</button></form>
      </div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-ink-700"><div className="h-full bg-violet-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
      <ul className="space-y-1.5 text-sm">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span aria-hidden="true" className={s.done ? "text-pulse" : "text-slate-600"}>{s.done ? "✓" : "○"}</span>
            {s.done ? <span className="text-slate-500 line-through">{s.label}</span> : <Link href={s.href} className="text-slate-200 hover:text-violet-300">{s.label}</Link>}
          </li>
        ))}
      </ul>
    </section>
  );
}
