import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT, pick } from "@/lib/i18n";
import Notice from "@/components/Notice";
import { createPersistentTeam, addPersistentMember, leavePersistentTeam, disbandPersistentTeam, registerPersistentTeam } from "./actions";

export const metadata = { title: "Týmy" };

export default async function TeamsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { locale } = await getT();
  const L = (cs: string, sk: string, en: string) => pick(locale, cs, sk, en);
  const me = (await auth())?.user;
  const [teams, open] = await Promise.all([
    db.team.findMany({ include: { members: { include: { user: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.tournament.findMany({ where: { status: "UPCOMING", teamSize: { gt: 1 } }, orderBy: { startsAt: "asc" } }),
  ]);
  // historie: výsledky turnajů, kde tým hrál
  const hist = await db.tournamentTeam.findMany({
    where: { teamId: { in: teams.map((t) => t.id) }, tournament: { championName: { not: null } } },
    include: { tournament: true },
  });
  const mine = teams.filter((t) => me && t.members.some((m) => m.userId === me.id));
  const others = teams.filter((t) => !mine.includes(t));
  const Card = (t: (typeof teams)[number]) => {
    const captain = me?.id === t.captainId || me?.role === "ADMIN";
    const wins = hist.filter((h) => h.teamId === t.id && h.tournament.championName === h.name);
    const played = hist.filter((h) => h.teamId === t.id).length;
    const isMember = !!me && t.members.some((m) => m.userId === me.id);
    return (
      <article key={t.id} className="card space-y-3 p-4">
        <div className="flex items-center gap-3">
          {t.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={t.logoUrl} alt="" className="h-12 w-12 rounded object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded bg-ink-700 text-sm font-bold">{(t.tag ?? t.name).slice(0, 3)}</span>}
          <div>
            <h3 className="font-semibold">{t.name}{t.tag && <span className="ml-2 text-xs text-slate-400">[{t.tag}]</span>}</h3>
            <p className="text-xs text-slate-500">{played} {L("turnajů", "turnajov", "tournaments")} · 🏆 {wins.length}</p>
          </div>
        </div>
        <p className="text-sm text-slate-300">
          {t.members.map((m) => (
            <Link key={m.id} href={`/players/${m.user.handle}`} className="mr-2 hover:text-violet-300">{m.user.username}{m.userId === t.captainId ? " ★" : ""}</Link>
          ))}
        </p>
        {captain && (
          <form action={addPersistentMember.bind(null, t.id)} className="flex gap-2">
            <input name="handle" required placeholder="@handle" className="input py-1.5 text-xs" />
            <button className="btn-ghost px-3 py-1.5 text-xs">{L("Přidat člena", "Pridať člena", "Add member")}</button>
          </form>
        )}
        {me?.id === t.captainId && open.length > 0 && (
          <form action={registerPersistentTeam.bind(null, t.id)} className="flex gap-2">
            <select name="tournamentId" className="input py-1.5 text-xs">
              {open.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.teamSize}v{o.teamSize})</option>)}
            </select>
            <button className="btn px-3 py-1.5 text-xs">{L("Přihlásit do turnaje", "Prihlásiť do turnaja", "Enter tournament")}</button>
          </form>
        )}
        <div className="flex gap-3 text-xs">
          {isMember && <form action={leavePersistentTeam.bind(null, t.id)}><button className="text-slate-500 hover:text-ember">{L("Opustit tým", "Opustiť tím", "Leave")}</button></form>}
          {captain && <form action={disbandPersistentTeam.bind(null, t.id)}><button className="text-slate-500 hover:text-ember">{L("Rozpustit", "Rozpustiť", "Disband")}</button></form>}
        </div>
      </article>
    );
  };
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{L("Týmy", "Tímy", "Teams")}</h1>
      <Notice msg={msg} locale={locale} />
      {me && (
        <form action={createPersistentTeam} className="card grid gap-3 p-5 md:grid-cols-4">
          <input name="name" required minLength={2} maxLength={40} placeholder={L("Název týmu", "Názov tímu", "Team name")} className="input md:col-span-2" />
          <input name="tag" maxLength={5} placeholder="TAG" className="input" />
          <input name="logoUrl" placeholder={L("URL loga (https://…, volitelné)", "URL loga (https://…, voliteľné)", "Logo URL (https://…, optional)")} className="input" />
          <div><button className="btn">{L("Založit tým", "Založiť tím", "Create team")}</button></div>
        </form>
      )}
      {mine.length > 0 && <section className="space-y-3"><h2 className="font-semibold">{L("Moje týmy", "Moje tímy", "My teams")}</h2><div className="grid gap-4 md:grid-cols-2">{mine.map(Card)}</div></section>}
      <section className="space-y-3">
        <h2 className="font-semibold">{L("Všechny týmy", "Všetky tímy", "All teams")}</h2>
        {others.length === 0 && <p className="text-sm text-slate-500">{L("Zatím žádné.", "Zatiaľ žiadne.", "None yet.")}</p>}
        <div className="grid gap-4 md:grid-cols-2">{others.map(Card)}</div>
      </section>
    </div>
  );
}
